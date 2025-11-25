/**
 * HeySalad QC - Property-Based Tests for Detection Log Repository
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DetectionLogRepository } from './detection-log-repository';

const fcConfig = { numRuns: 100 };

// In-memory mock D1 database for testing
class MockD1Database {
  private logs: Map<string, {
    id: string;
    station_id: string;
    detected_items: string;
    confidence_scores: string | null;
    pass_fail: 'pass' | 'fail';
    image_url: string | null;
    timestamp: string;
  }> = new Map();

  prepare(query: string) {
    const self = this;
    return {
      bind: (...args: unknown[]) => ({
        all: async <T>() => {
          if (query.includes('SELECT') && query.includes('FROM detection_logs') && query.includes('WHERE station_id')) {
            const stationId = args[0] as string;
            const limit = args[1] as number;
            const results = Array.from(self.logs.values())
              .filter(log => log.station_id === stationId)
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, limit);
            return { results } as { results: T[] };
          }
          return { results: [] as T[] };
        },
        first: async <T>() => {
          if (query.includes('SELECT') && query.includes('WHERE id =')) {
            const id = args[0] as string;
            const result = self.logs.get(id);
            return (result || null) as T | null;
          }
          if (query.includes('COUNT')) {
            const stationId = args[0] as string;
            const count = Array.from(self.logs.values()).filter(log => log.station_id === stationId).length;
            return { count } as T;
          }
          return null;
        },
        run: async () => {
          if (query.includes('INSERT')) {
            const [id, station_id, detected_items, confidence_scores, pass_fail, image_url, timestamp] = args as [string, string, string, string, 'pass' | 'fail', string | null, string];
            self.logs.set(id, { id, station_id, detected_items, confidence_scores, pass_fail, image_url, timestamp });
            return { meta: { changes: 1 } };
          }
          if (query.includes('DELETE')) {
            const stationId = args[0] as string;
            let changes = 0;
            for (const [id, log] of self.logs) {
              if (log.station_id === stationId) {
                self.logs.delete(id);
                changes++;
              }
            }
            return { meta: { changes } };
          }
          return { meta: { changes: 0 } };
        }
      })
    };
  }

  clear() {
    this.logs.clear();
  }
}

// UUID arbitrary - generate two distinct UUIDs
const distinctUuidPairArb = fc.tuple(fc.uuid(), fc.uuid()).filter(([a, b]) => a !== b);

describe('Detection Log Repository Property Tests', () => {
  let mockDb: MockD1Database;
  let repository: DetectionLogRepository;

  beforeEach(() => {
    mockDb = new MockD1Database();
    repository = new DetectionLogRepository(mockDb as unknown as D1Database);
  });

  /**
   * **Feature: heysalad-qc, Property 7: Detection Log Station Filtering**
   * 
   * *For any* station ID, retrieving detection logs should return only logs
   * where the station_id matches the requested station, and the result count
   * should not exceed the specified limit (default 20).
   * 
   * **Validates: Requirements 3.5, 5.7**
   */
  describe('Property 7: Detection Log Station Filtering', () => {
    test('returns only logs matching the requested station_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          distinctUuidPairArb,
          fc.array(fc.constantFrom('pass', 'fail') as fc.Arbitrary<'pass' | 'fail'>, { minLength: 2, maxLength: 10 }),
          async ([stationId1, stationId2], passFails) => {
            mockDb.clear();
            
            // Create logs for both stations alternating
            for (let i = 0; i < passFails.length; i++) {
              const targetStation = i % 2 === 0 ? stationId1 : stationId2;
              await repository.create({
                station_id: targetStation,
                detected_items: [],
                confidence_scores: {},
                pass_fail: passFails[i],
                image_url: null
              });
            }
            
            // Query logs for station 1
            const logsForStation1 = await repository.getByStationId(stationId1);
            
            // All returned logs should have station_id matching stationId1
            for (const log of logsForStation1) {
              expect(log.station_id).toBe(stationId1);
            }
            
            // Query logs for station 2
            const logsForStation2 = await repository.getByStationId(stationId2);
            
            // All returned logs should have station_id matching stationId2
            for (const log of logsForStation2) {
              expect(log.station_id).toBe(stationId2);
            }
          }
        ),
        fcConfig
      );
    });

    test('result count does not exceed specified limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 30 }),
          async (stationId, numLogs, limit) => {
            mockDb.clear();
            
            // Create multiple logs for the station
            for (let i = 0; i < numLogs; i++) {
              await repository.create({
                station_id: stationId,
                detected_items: [],
                confidence_scores: {},
                pass_fail: 'pass',
                image_url: null
              });
            }
            
            // Query with limit
            const logs = await repository.getByStationId(stationId, limit);
            
            // Result count should not exceed limit
            expect(logs.length).toBeLessThanOrEqual(limit);
            
            // Result count should be min(numLogs, limit)
            expect(logs.length).toBe(Math.min(numLogs, limit));
          }
        ),
        fcConfig
      );
    });

    test('default limit is 20', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 25, max: 50 }),
          async (stationId, numLogs) => {
            mockDb.clear();
            
            // Create more than 20 logs
            for (let i = 0; i < numLogs; i++) {
              await repository.create({
                station_id: stationId,
                detected_items: [],
                confidence_scores: {},
                pass_fail: 'pass',
                image_url: null
              });
            }
            
            // Query without specifying limit
            const logs = await repository.getByStationId(stationId);
            
            // Should return at most 20 logs (default limit)
            expect(logs.length).toBeLessThanOrEqual(20);
          }
        ),
        fcConfig
      );
    });

    test('returns empty array for station with no logs', async () => {
      await fc.assert(
        fc.asyncProperty(
          distinctUuidPairArb,
          async ([stationIdWithLogs, stationIdWithoutLogs]) => {
            mockDb.clear();
            
            // Create logs only for one station
            await repository.create({
              station_id: stationIdWithLogs,
              detected_items: [],
              confidence_scores: {},
              pass_fail: 'pass',
              image_url: null
            });
            
            // Query for station without logs
            const logs = await repository.getByStationId(stationIdWithoutLogs);
            
            expect(logs).toHaveLength(0);
          }
        ),
        fcConfig
      );
    });

    test('logs are ordered by timestamp descending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 2, max: 10 }),
          async (stationId, numLogs) => {
            mockDb.clear();
            
            // Create logs with small delays to ensure different timestamps
            for (let i = 0; i < numLogs; i++) {
              await repository.create({
                station_id: stationId,
                detected_items: [],
                confidence_scores: {},
                pass_fail: 'pass',
                image_url: null
              });
            }
            
            const logs = await repository.getByStationId(stationId);
            
            // Verify descending order by timestamp
            for (let i = 1; i < logs.length; i++) {
              const prevTime = new Date(logs[i - 1].timestamp).getTime();
              const currTime = new Date(logs[i].timestamp).getTime();
              expect(prevTime).toBeGreaterThanOrEqual(currTime);
            }
          }
        ),
        fcConfig
      );
    });
  });

  describe('Detection Log CRUD operations', () => {
    test('created log can be retrieved by id', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom('pass', 'fail') as fc.Arbitrary<'pass' | 'fail'>,
          async (stationId, passFail) => {
            mockDb.clear();
            
            const created = await repository.create({
              station_id: stationId,
              detected_items: [],
              confidence_scores: {},
              pass_fail: passFail,
              image_url: null
            });
            
            const retrieved = await repository.getById(created.id);
            
            expect(retrieved).not.toBeNull();
            expect(retrieved!.id).toBe(created.id);
            expect(retrieved!.station_id).toBe(stationId);
            expect(retrieved!.pass_fail).toBe(passFail);
          }
        ),
        fcConfig
      );
    });
  });
});
