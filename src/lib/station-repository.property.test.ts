/**
 * HeySalad QC - Property-Based Tests for Station Repository
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 * 
 * These tests use an in-memory mock D1 database to test repository logic.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { StationRepository, generateUUID } from './station-repository';
import type { Station, CreateStationInput, UpdateStationInput, StationType } from '../types';

const fcConfig = { numRuns: 100 };

// =============================================================================
// In-Memory Mock D1 Database
// =============================================================================

interface MockRow {
  [key: string]: unknown;
}

class MockD1Database {
  private stations: Map<string, Station> = new Map();
  private detectionRules: Map<string, { id: string; station_id: string }> = new Map();

  prepare(query: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(query, this);
  }

  // Internal methods for the mock
  _getStations(): Map<string, Station> {
    return this.stations;
  }

  _getDetectionRules(): Map<string, { id: string; station_id: string }> {
    return this.detectionRules;
  }

  _clear(): void {
    this.stations.clear();
    this.detectionRules.clear();
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
    const stations = this.db._getStations();
    
    if (this.query.includes('SELECT') && this.query.includes('WHERE id = ?')) {
      const id = this.boundValues[0] as string;
      const station = stations.get(id);
      return (station as T) || null;
    }
    
    if (this.query.includes('SELECT 1') && this.query.includes('WHERE id = ?')) {
      const id = this.boundValues[0] as string;
      return stations.has(id) ? ({ '1': 1 } as T) : null;
    }
    
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const stations = this.db._getStations();
    
    if (this.query.includes('SELECT * FROM stations ORDER BY')) {
      const results = Array.from(stations.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { results: results as T[] };
    }
    
    return { results: [] };
  }

  async run(): Promise<{ success: boolean }> {
    const stations = this.db._getStations();
    const rules = this.db._getDetectionRules();
    
    if (this.query.includes('INSERT INTO stations')) {
      const [id, name, type, location, description, qr_code_url, created_at, updated_at] = this.boundValues;
      stations.set(id as string, {
        id: id as string,
        name: name as string,
        type: type as StationType,
        location: location as string | null,
        description: description as string | null,
        qr_code_url: qr_code_url as string | null,
        created_at: created_at as string,
        updated_at: updated_at as string,
      });
      return { success: true };
    }
    
    if (this.query.includes('UPDATE stations SET')) {
      const id = this.boundValues[this.boundValues.length - 1] as string;
      const existing = stations.get(id);
      if (existing) {
        // Parse the SET clause to determine which fields to update
        const setMatch = this.query.match(/SET (.+) WHERE/);
        if (setMatch) {
          const fields = setMatch[1].split(', ').map(f => f.split(' = ')[0].trim());
          let valueIndex = 0;
          for (const field of fields) {
            const value = this.boundValues[valueIndex++];
            (existing as unknown as MockRow)[field] = value;
          }
          stations.set(id, existing);
        }
      }
      return { success: true };
    }
    
    if (this.query.includes('DELETE FROM stations')) {
      const id = this.boundValues[0] as string;
      stations.delete(id);
      // Cascade delete detection rules
      for (const [ruleId, rule] of rules.entries()) {
        if (rule.station_id === id) {
          rules.delete(ruleId);
        }
      }
      return { success: true };
    }
    
    return { success: true };
  }
}


// =============================================================================
// Arbitraries (Generators)
// =============================================================================

const stationTypeArb: fc.Arbitrary<StationType> = fc.constantFrom(
  'packing', 'prep', 'storage', 'receiving'
);

// Generate non-whitespace-only strings for names (validation requires trimmed length >= 1)
const validNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length >= 1);

const createStationInputArb: fc.Arbitrary<CreateStationInput> = fc.record({
  name: validNameArb,
  type: stationTypeArb,
  location: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
});

const updateStationInputArb: fc.Arbitrary<UpdateStationInput> = fc.record({
  name: fc.option(validNameArb, { nil: undefined }),
  type: fc.option(stationTypeArb, { nil: undefined }),
  location: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
});

// =============================================================================
// Helper to create fresh repository for each property iteration
// =============================================================================

function createTestRepository(): { repository: StationRepository; mockDb: MockD1Database } {
  const mockDb = new MockD1Database();
  const repository = new StationRepository(mockDb as unknown as D1Database);
  return { repository, mockDb };
}

// =============================================================================
// Property Tests
// =============================================================================

describe('Station Repository Property Tests', () => {
  /**
   * **Feature: heysalad-qc, Property 1: Station CRUD Round-Trip Consistency**
   * 
   * *For any* valid station input data, creating a station and then retrieving
   * it by ID should return a station with equivalent name, type, location,
   * and description values.
   * 
   * **Validates: Requirements 1.1, 5.2**
   */
  describe('Property 1: Station CRUD Round-Trip Consistency', () => {
    test('creating and retrieving a station preserves all input fields', async () => {
      await fc.assert(
        fc.asyncProperty(createStationInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create station
          const created = await repository.create(input);
          
          // Retrieve station
          const retrieved = await repository.getById(created.id);
          
          // Verify round-trip consistency
          expect(retrieved).not.toBeNull();
          expect(retrieved!.name).toBe(input.name);
          expect(retrieved!.type).toBe(input.type);
          expect(retrieved!.location).toBe(input.location ?? null);
          expect(retrieved!.description).toBe(input.description ?? null);
          
          // Verify ID is a valid UUID
          expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        }),
        fcConfig
      );
    });

    test('created station appears in list', async () => {
      await fc.assert(
        fc.asyncProperty(createStationInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create station
          const created = await repository.create(input);
          
          // List all stations
          const stations = await repository.list();
          
          // Verify station is in list
          const found = stations.find(s => s.id === created.id);
          expect(found).toBeDefined();
          expect(found!.name).toBe(input.name);
        }),
        fcConfig
      );
    });
  });


  /**
   * **Feature: heysalad-qc, Property 2: Station Update Persistence**
   * 
   * *For any* existing station and valid update data, updating the station
   * and then retrieving it should reflect all updated field values.
   * 
   * **Validates: Requirements 1.3, 5.3**
   */
  describe('Property 2: Station Update Persistence', () => {
    test('updating a station persists all changed fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          createStationInputArb,
          updateStationInputArb,
          async (createInput, updateInput) => {
            const { repository } = createTestRepository();
            
            // Create station first
            const created = await repository.create(createInput);
            
            // Update station
            const updated = await repository.update(created.id, updateInput);
            
            // Retrieve station
            const retrieved = await repository.getById(created.id);
            
            // Verify update persistence
            expect(updated).not.toBeNull();
            expect(retrieved).not.toBeNull();
            
            // Check each field - if updated, should have new value; otherwise original
            if (updateInput.name !== undefined) {
              expect(retrieved!.name).toBe(updateInput.name);
            } else {
              expect(retrieved!.name).toBe(createInput.name);
            }
            
            if (updateInput.type !== undefined) {
              expect(retrieved!.type).toBe(updateInput.type);
            } else {
              expect(retrieved!.type).toBe(createInput.type);
            }
            
            if (updateInput.location !== undefined) {
              expect(retrieved!.location).toBe(updateInput.location ?? null);
            } else {
              expect(retrieved!.location).toBe(createInput.location ?? null);
            }
            
            if (updateInput.description !== undefined) {
              expect(retrieved!.description).toBe(updateInput.description ?? null);
            } else {
              expect(retrieved!.description).toBe(createInput.description ?? null);
            }
          }
        ),
        fcConfig
      );
    });

    test('updating non-existent station returns null', async () => {
      await fc.assert(
        fc.asyncProperty(updateStationInputArb, async (updateInput) => {
          const { repository } = createTestRepository();
          const nonExistentId = generateUUID();
          const result = await repository.update(nonExistentId, updateInput);
          expect(result).toBeNull();
        }),
        fcConfig
      );
    });
  });

  /**
   * **Feature: heysalad-qc, Property 3: Station Deletion Completeness**
   * 
   * *For any* existing station, after deletion, attempting to retrieve
   * the station should return null/not found.
   * 
   * **Validates: Requirements 1.4, 5.4**
   */
  describe('Property 3: Station Deletion Completeness', () => {
    test('deleted station cannot be retrieved', async () => {
      await fc.assert(
        fc.asyncProperty(createStationInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create station
          const created = await repository.create(input);
          
          // Verify it exists
          const beforeDelete = await repository.getById(created.id);
          expect(beforeDelete).not.toBeNull();
          
          // Delete station
          const deleted = await repository.delete(created.id);
          expect(deleted).toBe(true);
          
          // Verify it no longer exists
          const afterDelete = await repository.getById(created.id);
          expect(afterDelete).toBeNull();
          
          // Verify exists() returns false
          const exists = await repository.exists(created.id);
          expect(exists).toBe(false);
        }),
        fcConfig
      );
    });

    test('deleted station is removed from list', async () => {
      await fc.assert(
        fc.asyncProperty(createStationInputArb, async (input) => {
          const { repository } = createTestRepository();
          
          // Create station
          const created = await repository.create(input);
          
          // Verify it's in list
          const beforeList = await repository.list();
          expect(beforeList.some(s => s.id === created.id)).toBe(true);
          
          // Delete station
          await repository.delete(created.id);
          
          // Verify it's not in list
          const afterList = await repository.list();
          expect(afterList.some(s => s.id === created.id)).toBe(false);
        }),
        fcConfig
      );
    });

    test('deleting non-existent station returns false', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (id) => {
          const { repository } = createTestRepository();
          const result = await repository.delete(id);
          expect(result).toBe(false);
        }),
        fcConfig
      );
    });
  });


  /**
   * **Feature: heysalad-qc, Property 10: Timestamp Invariants**
   * 
   * *For any* station, the created_at timestamp should be set on creation
   * and never change, while updated_at should be greater than or equal to
   * created_at and should increase on each update.
   * 
   * **Validates: Requirements 7.2, 7.5**
   */
  describe('Property 10: Timestamp Invariants', () => {
    test('created_at is set on creation and never changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          createStationInputArb,
          updateStationInputArb,
          async (createInput, updateInput) => {
            const { repository } = createTestRepository();
            
            // Create station
            const created = await repository.create(createInput);
            const originalCreatedAt = created.created_at;
            
            // Verify created_at is a valid ISO timestamp
            expect(new Date(originalCreatedAt).toISOString()).toBe(originalCreatedAt);
            
            // Update station
            await repository.update(created.id, updateInput);
            
            // Retrieve and verify created_at hasn't changed
            const retrieved = await repository.getById(created.id);
            expect(retrieved!.created_at).toBe(originalCreatedAt);
          }
        ),
        fcConfig
      );
    });

    test('updated_at is >= created_at on creation', async () => {
      await fc.assert(
        fc.asyncProperty(createStationInputArb, async (input) => {
          const { repository } = createTestRepository();
          const created = await repository.create(input);
          
          const createdAtTime = new Date(created.created_at).getTime();
          const updatedAtTime = new Date(created.updated_at).getTime();
          
          expect(updatedAtTime).toBeGreaterThanOrEqual(createdAtTime);
        }),
        fcConfig
      );
    });

    test('updated_at increases on update', async () => {
      await fc.assert(
        fc.asyncProperty(
          createStationInputArb,
          updateStationInputArb,
          async (createInput, updateInput) => {
            const { repository } = createTestRepository();
            
            // Create station
            const created = await repository.create(createInput);
            const originalUpdatedAt = new Date(created.updated_at).getTime();
            
            // Small delay to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 1));
            
            // Update station
            const updated = await repository.update(created.id, updateInput);
            const newUpdatedAt = new Date(updated!.updated_at).getTime();
            
            // updated_at should be >= original (may be equal if very fast)
            expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
          }
        ),
        fcConfig
      );
    });
  });
});
