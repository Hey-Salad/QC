/**
 * HeySalad QC - Property-Based Tests for Camera Mapping Repository
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 * 
 * These tests use an in-memory mock D1 database to test repository logic.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { CameraMappingRepository } from './camera-mapping-repository';
import type { CameraMapping, CreateCameraMappingInput, UpdateCameraMappingInput } from '../types';

const fcConfig = { numRuns: 100 };

// =============================================================================
// In-Memory Mock D1 Database
// =============================================================================

interface MockRow {
  [key: string]: unknown;
}

class MockD1Database {
  private cameraMappings: Map<string, CameraMapping> = new Map();

  prepare(query: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(query, this);
  }

  _getCameraMappings(): Map<string, CameraMapping> {
    return this.cameraMappings;
  }

  _clear(): void {
    this.cameraMappings.clear();
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
    const mappings = this.db._getCameraMappings();
    
    if (this.query.includes('SELECT') && this.query.includes('WHERE camera_id = ?')) {
      const cameraId = this.boundValues[0] as string;
      const mapping = mappings.get(cameraId);
      return (mapping as T) || null;
    }
    
    if (this.query.includes('SELECT 1') && this.query.includes('WHERE camera_id = ?')) {
      const cameraId = this.boundValues[0] as string;
      return mappings.has(cameraId) ? ({ '1': 1 } as T) : null;
    }
    
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const mappings = this.db._getCameraMappings();
    
    if (this.query.includes('SELECT * FROM camera_mappings ORDER BY')) {
      const results = Array.from(mappings.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { results: results as T[] };
    }
    
    if (this.query.includes('SELECT * FROM camera_mappings WHERE station_id = ?')) {
      const stationId = this.boundValues[0] as string;
      const results = Array.from(mappings.values())
        .filter(m => m.station_id === stationId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { results: results as T[] };
    }
    
    return { results: [] };
  }

  async run(): Promise<{ success: boolean }> {
    const mappings = this.db._getCameraMappings();
    
    if (this.query.includes('INSERT INTO camera_mappings')) {
      const [camera_id, station_id, rtsp_url, name, created_at, updated_at] = this.boundValues;
      mappings.set(camera_id as string, {
        camera_id: camera_id as string,
        station_id: station_id as string,
        rtsp_url: rtsp_url as string,
        name: name as string | null,
        created_at: created_at as string,
        updated_at: updated_at as string,
      });
      return { success: true };
    }
    
    if (this.query.includes('UPDATE camera_mappings SET')) {
      const cameraId = this.boundValues[this.boundValues.length - 1] as string;
      const existing = mappings.get(cameraId);
      if (existing) {
        const setMatch = this.query.match(/SET (.+) WHERE/);
        if (setMatch) {
          const fields = setMatch[1].split(', ').map(f => f.split(' = ')[0].trim());
          let valueIndex = 0;
          for (const field of fields) {
            const value = this.boundValues[valueIndex++];
            (existing as unknown as MockRow)[field] = value;
          }
          mappings.set(cameraId, existing);
        }
      }
      return { success: true };
    }
    
    if (this.query.includes('DELETE FROM camera_mappings')) {
      const cameraId = this.boundValues[0] as string;
      mappings.delete(cameraId);
      return { success: true };
    }
    
    return { success: true };
  }
}


// =============================================================================
// Arbitraries (Generators)
// =============================================================================

// Generate valid camera IDs (non-empty strings)
const cameraIdArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length >= 1);

// Generate valid station IDs (UUIDs)
const stationIdArb = fc.uuid();

// Generate valid RTSP URLs
const rtspUrlArb = fc.string({ minLength: 1, maxLength: 200 })
  .map(s => `rtsp://camera.local/${s.replace(/[^a-zA-Z0-9]/g, '')}`);

// Generate optional camera names
const cameraNameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1),
  { nil: undefined }
);

const createCameraMappingInputArb: fc.Arbitrary<CreateCameraMappingInput> = fc.record({
  camera_id: cameraIdArb,
  station_id: stationIdArb,
  rtsp_url: rtspUrlArb,
  name: cameraNameArb,
});

const updateCameraMappingInputArb: fc.Arbitrary<UpdateCameraMappingInput> = fc.record({
  station_id: fc.option(stationIdArb, { nil: undefined }),
  rtsp_url: fc.option(rtspUrlArb, { nil: undefined }),
  name: cameraNameArb,
});

// =============================================================================
// Helper to create fresh repository for each property iteration
// =============================================================================

function createTestRepository(): { repository: CameraMappingRepository; mockDb: MockD1Database } {
  const mockDb = new MockD1Database();
  const repository = new CameraMappingRepository(mockDb as unknown as D1Database);
  return { repository, mockDb };
}

// =============================================================================
// Property Tests
// =============================================================================

describe('Camera Mapping Repository Property Tests', () => {
  /**
   * **Feature: cloud-vision-integration, Property 2: Camera mapping storage**
   * 
   * *For any* valid camera registration request, after storage, querying by
   * camera_id SHALL return the exact camera_id, station_id, and rtsp_url
   * that were submitted.
   * 
   * **Validates: Requirements 2.1**
   */
  describe('Property 2: Camera mapping storage', () => {
    test('creating and retrieving a camera mapping preserves all input fields', async () => {
      await fc.assert(
        fc.asyncProperty(createCameraMappingInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create camera mapping
          const created = await repository.create(input);
          
          // Retrieve camera mapping
          const retrieved = await repository.getById(created.camera_id);
          
          // Verify round-trip consistency
          expect(retrieved).not.toBeNull();
          expect(retrieved!.camera_id).toBe(input.camera_id);
          expect(retrieved!.station_id).toBe(input.station_id);
          expect(retrieved!.rtsp_url).toBe(input.rtsp_url);
          expect(retrieved!.name).toBe(input.name ?? null);
        }),
        fcConfig
      );
    });

    test('created camera mapping appears in list', async () => {
      await fc.assert(
        fc.asyncProperty(createCameraMappingInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create camera mapping
          const created = await repository.create(input);
          
          // List all camera mappings
          const mappings = await repository.list();
          
          // Verify mapping is in list
          const found = mappings.find(m => m.camera_id === created.camera_id);
          expect(found).toBeDefined();
          expect(found!.station_id).toBe(input.station_id);
          expect(found!.rtsp_url).toBe(input.rtsp_url);
        }),
        fcConfig
      );
    });

    test('camera mapping can be retrieved by station_id', async () => {
      await fc.assert(
        fc.asyncProperty(createCameraMappingInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create camera mapping
          await repository.create(input);
          
          // Get by station ID
          const mappings = await repository.getByStationId(input.station_id);
          
          // Verify mapping is found
          const found = mappings.find(m => m.camera_id === input.camera_id);
          expect(found).toBeDefined();
          expect(found!.camera_id).toBe(input.camera_id);
        }),
        fcConfig
      );
    });
  });


  /**
   * **Feature: cloud-vision-integration, Property 4: Camera mapping update**
   * 
   * *For any* camera mapping that is updated, subsequent queries SHALL return
   * the updated values, not the original values.
   * 
   * **Validates: Requirements 2.3**
   */
  describe('Property 4: Camera mapping update', () => {
    test('updating a camera mapping persists all changed fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          createCameraMappingInputArb,
          updateCameraMappingInputArb,
          async (createInput, updateInput) => {
            const { repository } = createTestRepository();
            
            // Create camera mapping first
            const created = await repository.create(createInput);
            
            // Update camera mapping
            const updated = await repository.update(created.camera_id, updateInput);
            
            // Retrieve camera mapping
            const retrieved = await repository.getById(created.camera_id);
            
            // Verify update persistence
            expect(updated).not.toBeNull();
            expect(retrieved).not.toBeNull();
            
            // Check each field - if updated, should have new value; otherwise original
            if (updateInput.station_id !== undefined) {
              expect(retrieved!.station_id).toBe(updateInput.station_id);
            } else {
              expect(retrieved!.station_id).toBe(createInput.station_id);
            }
            
            if (updateInput.rtsp_url !== undefined) {
              expect(retrieved!.rtsp_url).toBe(updateInput.rtsp_url);
            } else {
              expect(retrieved!.rtsp_url).toBe(createInput.rtsp_url);
            }
            
            if (updateInput.name !== undefined) {
              expect(retrieved!.name).toBe(updateInput.name ?? null);
            } else {
              expect(retrieved!.name).toBe(createInput.name ?? null);
            }
          }
        ),
        fcConfig
      );
    });

    test('updating non-existent camera mapping returns null', async () => {
      await fc.assert(
        fc.asyncProperty(cameraIdArb, updateCameraMappingInputArb, async (cameraId, updateInput) => {
          const { repository } = createTestRepository();
          const result = await repository.update(cameraId, updateInput);
          expect(result).toBeNull();
        }),
        fcConfig
      );
    });
  });

  /**
   * **Feature: cloud-vision-integration, Property 5: Camera mapping deletion**
   * 
   * *For any* camera mapping that is deleted, subsequent frame submissions
   * for that camera_id SHALL be rejected.
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 5: Camera mapping deletion', () => {
    test('deleted camera mapping cannot be retrieved', async () => {
      await fc.assert(
        fc.asyncProperty(createCameraMappingInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create camera mapping
          const created = await repository.create(input);
          
          // Verify it exists
          const beforeDelete = await repository.getById(created.camera_id);
          expect(beforeDelete).not.toBeNull();
          
          // Delete camera mapping
          const deleted = await repository.delete(created.camera_id);
          expect(deleted).toBe(true);
          
          // Verify it no longer exists
          const afterDelete = await repository.getById(created.camera_id);
          expect(afterDelete).toBeNull();
          
          // Verify exists() returns false
          const exists = await repository.exists(created.camera_id);
          expect(exists).toBe(false);
        }),
        fcConfig
      );
    });

    test('deleted camera mapping is removed from list', async () => {
      await fc.assert(
        fc.asyncProperty(createCameraMappingInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create camera mapping
          const created = await repository.create(input);
          
          // Verify it's in list
          const beforeList = await repository.list();
          expect(beforeList.some(m => m.camera_id === created.camera_id)).toBe(true);
          
          // Delete camera mapping
          await repository.delete(created.camera_id);
          
          // Verify it's not in list
          const afterList = await repository.list();
          expect(afterList.some(m => m.camera_id === created.camera_id)).toBe(false);
        }),
        fcConfig
      );
    });

    test('deleting non-existent camera mapping returns false', async () => {
      await fc.assert(
        fc.asyncProperty(cameraIdArb, async (cameraId) => {
          const { repository } = createTestRepository();
          const result = await repository.delete(cameraId);
          expect(result).toBe(false);
        }),
        fcConfig
      );
    });
  });
});
