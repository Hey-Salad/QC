/**
 * HeySalad QC - Station Repository
 * 
 * Implements CRUD operations for stations using D1 database.
 * Handles UUID generation and timestamp management.
 * Requirements: 1.1, 1.3, 1.4, 7.2, 7.5
 */

import type { Station, CreateStationInput, UpdateStationInput } from '../types';

/**
 * Generates a UUID v4 string
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Gets current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Station repository for D1 database operations
 */
export class StationRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * List all stations
   * Requirements: 5.1
   */
  async list(): Promise<Station[]> {
    const result = await this.db
      .prepare('SELECT * FROM stations ORDER BY created_at DESC')
      .all<Station>();
    
    return result.results || [];
  }

  /**
   * Get a station by ID
   * Requirements: 5.1
   */
  async getById(id: string): Promise<Station | null> {
    const result = await this.db
      .prepare('SELECT * FROM stations WHERE id = ?')
      .bind(id)
      .first<Station>();
    
    return result || null;
  }

  /**
   * Create a new station
   * Requirements: 1.1, 5.2, 7.2
   */
  async create(input: CreateStationInput): Promise<Station> {
    const id = generateUUID();
    const now = getCurrentTimestamp();
    
    const station: Station = {
      id,
      name: input.name,
      type: input.type,
      location: input.location ?? null,
      description: input.description ?? null,
      qr_code_url: null,
      created_at: now,
      updated_at: now,
    };

    await this.db
      .prepare(`
        INSERT INTO stations (id, name, type, location, description, qr_code_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        station.id,
        station.name,
        station.type,
        station.location,
        station.description,
        station.qr_code_url,
        station.created_at,
        station.updated_at
      )
      .run();

    return station;
  }


  /**
   * Update an existing station
   * Requirements: 1.3, 5.3, 7.5
   */
  async update(id: string, input: UpdateStationInput): Promise<Station | null> {
    // First check if station exists
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const now = getCurrentTimestamp();
    
    // Build update fields
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.type !== undefined) {
      updates.push('type = ?');
      values.push(input.type);
    }
    if (input.location !== undefined) {
      updates.push('location = ?');
      values.push(input.location ?? null);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description ?? null);
    }

    // Always update updated_at
    updates.push('updated_at = ?');
    values.push(now);

    // Add id for WHERE clause
    values.push(id);

    await this.db
      .prepare(`UPDATE stations SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    // Return updated station
    return this.getById(id);
  }

  /**
   * Delete a station and associated detection rules
   * Requirements: 1.4, 5.4
   */
  async delete(id: string): Promise<boolean> {
    // Check if station exists
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    // Delete station (detection_rules will cascade delete due to FK constraint)
    await this.db
      .prepare('DELETE FROM stations WHERE id = ?')
      .bind(id)
      .run();

    return true;
  }

  /**
   * Check if a station exists
   */
  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT 1 FROM stations WHERE id = ? LIMIT 1')
      .bind(id)
      .first();
    
    return result !== null;
  }
}
