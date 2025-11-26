/**
 * HeySalad QC - Property-Based Tests for Camera Health Repository
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 * 
 * These tests verify the offline detection logic for cameras.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  calculateCameraStatus, 
  OFFLINE_TIMEOUT_SECONDS,
  CameraHealthRepository 
} from './camera-health-repository';
import type { CameraHealth } from '../types';

const fcConfig = { numRuns: 100 };

// =============================================================================
// In-Memory Mock D1 Database
// =============================================================================

class MockD1Database {
  private cameraHealth: Map<string, CameraHealth> = new Map();

  prepare(query: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(query, this);
  }

  _getCameraHealth(): Map<string, CameraHealth> {
    return this.cameraHealth;
  }

  _clear(): void {
    this.cameraHealth.clear();
  }
}

class MockD1PreparedStatement {
  private boundValues: unknown[] = [];
  private query: string;
  private db: MockD1Database;

  constructor(query: string, db: MockD1Database) {
    this.query = query;
    this.db = db;
  }

  bind(...values: unknown[]): MockD1PreparedStatement {
    this.boundValues = values;
    return this;
  }


  async first<T>(): Promise<T | null> {
    const healthMap = this.db._getCameraHealth();
    
    if (this.query.includes('SELECT') && this.query.includes('WHERE camera_id = ?')) {
      const cameraId = this.boundValues[0] as string;
      const health = healthMap.get(cameraId);
      return (health as T) || null;
    }
    
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const healthMap = this.db._getCameraHealth();
    
    if (this.query.includes('SELECT * FROM camera_health ORDER BY')) {
      const results = Array.from(healthMap.values())
        .sort((a, b) => a.camera_id.localeCompare(b.camera_id));
      return { results: results as T[] };
    }
    
    return { results: [] };
  }

  async run(): Promise<{ success: boolean }> {
    const healthMap = this.db._getCameraHealth();
    
    if (this.query.includes('INSERT OR IGNORE INTO camera_health')) {
      const cameraId = this.boundValues[0] as string;
      if (!healthMap.has(cameraId)) {
        healthMap.set(cameraId, {
          camera_id: cameraId,
          last_frame_at: null,
          error_count: 0,
          last_error: null,
          status: 'unknown',
        });
      }
      return { success: true };
    }
    
    if (this.query.includes('UPDATE camera_health') && this.query.includes('last_frame_at = ?')) {
      const frameTime = this.boundValues[0] as string;
      const cameraId = this.boundValues[1] as string;
      const existing = healthMap.get(cameraId);
      if (existing) {
        healthMap.set(cameraId, {
          ...existing,
          last_frame_at: frameTime,
          error_count: 0,
          last_error: null,
          status: 'online',
        });
      }
      return { success: true };
    }
    
    if (this.query.includes('UPDATE camera_health') && this.query.includes('error_count = error_count + 1')) {
      const errorMessage = this.boundValues[0] as string | null;
      const cameraId = this.boundValues[1] as string;
      const existing = healthMap.get(cameraId);
      if (existing) {
        healthMap.set(cameraId, {
          ...existing,
          error_count: existing.error_count + 1,
          last_error: errorMessage,
          status: 'error',
        });
      }
      return { success: true };
    }
    
    if (this.query.includes('UPDATE camera_health') && this.query.includes('error_count = 0')) {
      const cameraId = this.boundValues[0] as string;
      const existing = healthMap.get(cameraId);
      if (existing) {
        healthMap.set(cameraId, {
          ...existing,
          error_count: 0,
          last_error: null,
        });
      }
      return { success: true };
    }
    
    if (this.query.includes('DELETE FROM camera_health')) {
      const cameraId = this.boundValues[0] as string;
      healthMap.delete(cameraId);
      return { success: true };
    }
    
    return { success: true };
  }
}

// =============================================================================
// Arbitraries (Generators)
// =============================================================================

// Generate valid camera IDs
const cameraIdArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length >= 1);

// Generate timestamps within a reasonable range (past year to now)
const timestampArb = fc.date({
  min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  max: new Date(),
}).map(d => d.toISOString());

// Generate optional error messages
const errorMessageArb = fc.option(
  fc.string({ minLength: 1, maxLength: 200 }),
  { nil: undefined }
);

// =============================================================================
// Helper Functions
// =============================================================================

function createTestRepository(): { repository: CameraHealthRepository; mockDb: MockD1Database } {
  const mockDb = new MockD1Database();
  const repository = new CameraHealthRepository(mockDb as unknown as D1Database);
  return { repository, mockDb };
}

// =============================================================================
// Property Tests
// =============================================================================

describe('Camera Health Repository Property Tests', () => {
  /**
   * **Feature: cloud-vision-integration, Property 12: Camera offline timeout**
   * 
   * *For any* camera that has not sent frames for more than 60 seconds,
   * the health status SHALL be 'offline'.
   * 
   * **Validates: Requirements 5.4**
   */
  describe('Property 12: Camera offline timeout', () => {
    test('camera with last frame > 60 seconds ago has offline status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate seconds since last frame (61 to 3600 - definitely offline)
          fc.integer({ min: OFFLINE_TIMEOUT_SECONDS + 1, max: 3600 }),
          async (secondsAgo) => {
            const currentTime = new Date();
            const lastFrameTime = new Date(currentTime.getTime() - secondsAgo * 1000);
            const lastFrameAt = lastFrameTime.toISOString();
            
            // Calculate status with no errors
            const status = calculateCameraStatus(lastFrameAt, 0, currentTime);
            
            // Should be offline since > 60 seconds
            expect(status).toBe('offline');
          }
        ),
        fcConfig
      );
    });

    test('camera with last frame <= 60 seconds ago has online status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate seconds since last frame (0 to 60 - should be online)
          fc.integer({ min: 0, max: OFFLINE_TIMEOUT_SECONDS }),
          async (secondsAgo) => {
            const currentTime = new Date();
            const lastFrameTime = new Date(currentTime.getTime() - secondsAgo * 1000);
            const lastFrameAt = lastFrameTime.toISOString();
            
            // Calculate status with no errors
            const status = calculateCameraStatus(lastFrameAt, 0, currentTime);
            
            // Should be online since <= 60 seconds
            expect(status).toBe('online');
          }
        ),
        fcConfig
      );
    });

    test('camera with no frames ever has unknown status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate any error count (but we test with 0 to isolate unknown case)
          fc.constant(0),
          async () => {
            const currentTime = new Date();
            
            // Calculate status with null last_frame_at and no errors
            const status = calculateCameraStatus(null, 0, currentTime);
            
            // Should be unknown since no frames ever received
            expect(status).toBe('unknown');
          }
        ),
        fcConfig
      );
    });

    test('camera with errors has error status regardless of frame time', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate positive error count
          fc.integer({ min: 1, max: 100 }),
          // Generate optional last frame time
          fc.option(timestampArb, { nil: null }),
          async (errorCount, lastFrameAt) => {
            const currentTime = new Date();
            
            // Calculate status with errors
            const status = calculateCameraStatus(lastFrameAt, errorCount, currentTime);
            
            // Should be error since error_count > 0
            expect(status).toBe('error');
          }
        ),
        fcConfig
      );
    });

    test('repository getHealth returns offline for stale cameras', async () => {
      await fc.assert(
        fc.asyncProperty(
          cameraIdArb,
          // Generate seconds since last frame (definitely offline)
          fc.integer({ min: OFFLINE_TIMEOUT_SECONDS + 1, max: 3600 }),
          async (cameraId, secondsAgo) => {
            const { repository, mockDb } = createTestRepository();
            const currentTime = new Date();
            const lastFrameTime = new Date(currentTime.getTime() - secondsAgo * 1000);
            
            // Manually set up health record in mock DB
            mockDb._getCameraHealth().set(cameraId, {
              camera_id: cameraId,
              last_frame_at: lastFrameTime.toISOString(),
              error_count: 0,
              last_error: null,
              status: 'online', // DB might have stale status
            });
            
            // Get health with current time
            const health = await repository.getHealth(cameraId, currentTime);
            
            // Should calculate offline status dynamically
            expect(health).not.toBeNull();
            expect(health!.status).toBe('offline');
          }
        ),
        fcConfig
      );
    });

    test('updateLastFrame sets camera to online status', async () => {
      await fc.assert(
        fc.asyncProperty(cameraIdArb, async (cameraId) => {
          const { repository } = createTestRepository();
          
          // Update last frame
          const health = await repository.updateLastFrame(cameraId);
          
          // Should be online after receiving a frame
          expect(health.status).toBe('online');
          expect(health.error_count).toBe(0);
          expect(health.last_frame_at).not.toBeNull();
        }),
        fcConfig
      );
    });

    test('incrementErrorCount sets camera to error status', async () => {
      await fc.assert(
        fc.asyncProperty(cameraIdArb, errorMessageArb, async (cameraId, errorMessage) => {
          const { repository } = createTestRepository();
          
          // Increment error count
          const health = await repository.incrementErrorCount(cameraId, errorMessage);
          
          // Should be error after incrementing
          expect(health.status).toBe('error');
          expect(health.error_count).toBeGreaterThan(0);
        }),
        fcConfig
      );
    });
  });
});
