/**
 * HeySalad QC - Property-Based Tests for Vision Detection Repository
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 * 
 * These tests use an in-memory mock D1 database to test repository logic.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { VisionDetectionRepository } from './vision-detection-repository';
import type { CreateVisionDetectionInput } from './vision-detection-repository';
import type { VisionDetectedObject, VisionBoundingBox } from '../types';

const fcConfig = { numRuns: 100 };

// =============================================================================
// In-Memory Mock D1 Database
// =============================================================================

interface VisionDetectionRow {
  id: string;
  camera_id: string;
  station_id: string;
  timestamp: string;
  objects_json: string;
  thumbnail_key: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

class MockD1Database {
  private visionDetections: Map<string, VisionDetectionRow> = new Map();

  prepare(query: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(query, this);
  }

  _getVisionDetections(): Map<string, VisionDetectionRow> {
    return this.visionDetections;
  }

  _clear(): void {
    this.visionDetections.clear();
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
    const detections = this.db._getVisionDetections();
    
    // SELECT * FROM vision_detections WHERE id = ?
    if (this.query.includes('SELECT * FROM vision_detections WHERE id = ?')) {
      const id = this.boundValues[0] as string;
      const detection = detections.get(id);
      return (detection as T) || null;
    }
    
    // SELECT * FROM vision_detections WHERE station_id = ? ORDER BY timestamp DESC LIMIT 1
    if (this.query.includes('WHERE station_id = ?') && this.query.includes('LIMIT 1')) {
      const stationId = this.boundValues[0] as string;
      const results = Array.from(detections.values())
        .filter(d => d.station_id === stationId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return (results[0] as T) || null;
    }
    
    // COUNT query
    if (this.query.includes('COUNT(*)')) {
      const stationId = this.boundValues[0] as string;
      const count = Array.from(detections.values())
        .filter(d => d.station_id === stationId).length;
      return { count } as T;
    }
    
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const detections = this.db._getVisionDetections();
    
    // SELECT * FROM vision_detections WHERE station_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?
    if (this.query.includes('WHERE station_id = ?') && this.query.includes('LIMIT ? OFFSET ?')) {
      const stationId = this.boundValues[0] as string;
      const limit = this.boundValues[1] as number;
      const offset = this.boundValues[2] as number;
      
      const results = Array.from(detections.values())
        .filter(d => d.station_id === stationId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(offset, offset + limit);
      
      return { results: results as T[] };
    }
    
    return { results: [] };
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const detections = this.db._getVisionDetections();
    
    // INSERT INTO vision_detections
    if (this.query.includes('INSERT INTO vision_detections')) {
      const [id, camera_id, station_id, timestamp, objects_json, thumbnail_key, processing_time_ms] = this.boundValues;
      detections.set(id as string, {
        id: id as string,
        camera_id: camera_id as string,
        station_id: station_id as string,
        timestamp: timestamp as string,
        objects_json: objects_json as string,
        thumbnail_key: thumbnail_key as string | null,
        processing_time_ms: processing_time_ms as number | null,
        created_at: new Date().toISOString(),
      });
      return { success: true, meta: { changes: 1 } };
    }
    
    // DELETE FROM vision_detections WHERE id = ?
    if (this.query.includes('DELETE FROM vision_detections WHERE id = ?')) {
      const id = this.boundValues[0] as string;
      const existed = detections.has(id);
      detections.delete(id);
      return { success: true, meta: { changes: existed ? 1 : 0 } };
    }
    
    // DELETE FROM vision_detections WHERE station_id = ?
    if (this.query.includes('DELETE FROM vision_detections WHERE station_id = ?')) {
      const stationId = this.boundValues[0] as string;
      let changes = 0;
      for (const [id, detection] of detections.entries()) {
        if (detection.station_id === stationId) {
          detections.delete(id);
          changes++;
        }
      }
      return { success: true, meta: { changes } };
    }
    
    return { success: true, meta: { changes: 0 } };
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

// Generate valid bounding boxes (normalized 0-1 coordinates)
const bboxArb: fc.Arbitrary<VisionBoundingBox> = fc.record({
  x: fc.float({ min: 0, max: 1, noNaN: true }),
  y: fc.float({ min: 0, max: 1, noNaN: true }),
  width: fc.float({ min: 0, max: 1, noNaN: true }),
  height: fc.float({ min: 0, max: 1, noNaN: true }),
});

// Generate valid detected objects
const detectedObjectArb: fc.Arbitrary<VisionDetectedObject> = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  bbox: bboxArb,
});

// Generate array of detected objects
const detectedObjectsArb = fc.array(detectedObjectArb, { minLength: 0, maxLength: 10 });

// Generate optional thumbnail key
const thumbnailKeyArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1),
  { nil: undefined }
);

// Generate processing time in ms
const processingTimeMsArb = fc.integer({ min: 0, max: 10000 });

// Generate ISO timestamp - use integer timestamps to avoid invalid date issues
const timestampArb = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2030-01-01').getTime() 
}).map(ts => new Date(ts).toISOString());

// Generate create vision detection input
const createVisionDetectionInputArb: fc.Arbitrary<CreateVisionDetectionInput> = fc.record({
  camera_id: cameraIdArb,
  station_id: stationIdArb,
  objects: detectedObjectsArb,
  thumbnail_key: thumbnailKeyArb,
  processing_time_ms: processingTimeMsArb,
  timestamp: fc.option(timestampArb, { nil: undefined }),
});

// =============================================================================
// Helper to create fresh repository for each property iteration
// =============================================================================

function createTestRepository(): { repository: VisionDetectionRepository; mockDb: MockD1Database } {
  const mockDb = new MockD1Database();
  const repository = new VisionDetectionRepository(mockDb as unknown as D1Database);
  return { repository, mockDb };
}

// =============================================================================
// Property Tests
// =============================================================================

describe('Vision Detection Repository Property Tests', () => {
  /**
   * **Feature: cloud-vision-integration, Property 3: Camera-to-station association**
   * 
   * *For any* frame submitted with a registered camera_id, the resulting
   * Detection_Result SHALL have a station_id matching the registered mapping
   * for that camera.
   * 
   * **Validates: Requirements 2.2**
   */
  describe('Property 3: Camera-to-station association', () => {
    test('detection result station_id matches the input station_id for the camera', async () => {
      await fc.assert(
        fc.asyncProperty(createVisionDetectionInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create detection with camera_id and station_id
          const created = await repository.create(input);
          
          // Retrieve detection
          const retrieved = await repository.getById(created.id);
          
          // Verify station_id association is preserved
          expect(retrieved).not.toBeNull();
          expect(retrieved!.camera_id).toBe(input.camera_id);
          expect(retrieved!.station_id).toBe(input.station_id);
        }),
        fcConfig
      );
    });

    test('getLatestByStationId returns detection with correct station_id', async () => {
      await fc.assert(
        fc.asyncProperty(createVisionDetectionInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create detection
          await repository.create(input);
          
          // Get latest by station ID
          const latest = await repository.getLatestByStationId(input.station_id);
          
          // Verify station_id matches
          expect(latest).not.toBeNull();
          expect(latest!.station_id).toBe(input.station_id);
          expect(latest!.camera_id).toBe(input.camera_id);
        }),
        fcConfig
      );
    });

    test('getByStationId returns only detections for that station', async () => {
      await fc.assert(
        fc.asyncProperty(
          createVisionDetectionInputArb,
          createVisionDetectionInputArb,
          async (input1, input2) => {
            const { repository } = createTestRepository();
            
            // Create two detections with potentially different station_ids
            await repository.create(input1);
            await repository.create(input2);
            
            // Get detections for station 1
            const { detections: station1Detections } = await repository.getByStationId(input1.station_id);
            
            // All returned detections should have station_id matching input1.station_id
            for (const detection of station1Detections) {
              expect(detection.station_id).toBe(input1.station_id);
            }
            
            // If station_ids are different, station1 detections should not include station2's detection
            if (input1.station_id !== input2.station_id) {
              // input2's detection should not appear in station1's results
              for (const detection of station1Detections) {
                expect(detection.station_id).not.toBe(input2.station_id);
              }
            }
          }
        ),
        fcConfig
      );
    });

    test('detection preserves all object data including camera association', async () => {
      await fc.assert(
        fc.asyncProperty(createVisionDetectionInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create detection
          const created = await repository.create(input);
          
          // Retrieve detection
          const retrieved = await repository.getById(created.id);
          
          // Verify all fields are preserved
          expect(retrieved).not.toBeNull();
          expect(retrieved!.camera_id).toBe(input.camera_id);
          expect(retrieved!.station_id).toBe(input.station_id);
          expect(retrieved!.objects).toEqual(input.objects);
          expect(retrieved!.thumbnail_key).toBe(input.thumbnail_key ?? null);
          expect(retrieved!.processing_time_ms).toBe(input.processing_time_ms);
        }),
        fcConfig
      );
    });
  });
});
