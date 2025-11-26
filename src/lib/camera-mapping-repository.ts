/**
 * HeySalad QC - Camera Mapping Repository
 * 
 * Implements CRUD operations for camera_mappings table using D1 database.
 * Handles camera-to-station mappings for the Cloud Vision integration.
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import type { CameraMapping, CreateCameraMappingInput, UpdateCameraMappingInput } from '../types';
import { getCurrentTimestamp } from './station-repository';

/**
 * Camera mapping repository for D1 database operations
 */
export class CameraMappingRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * List all camera mappings
   * Requirements: 2.1
   */
  async list(): Promise<CameraMapping[]> {
    const result = await this.db
      .prepare('SELECT * FROM camera_mappings ORDER BY created_at DESC')
      .all<CameraMapping>();
    
    return result.results || [];
  }

  /**
   * Get a camera mapping by camera_id
   * Requirements: 2.1
   */
  async getById(cameraId: string): Promise<CameraMapping | null> {
    const result = await this.db
      .prepare('SELECT * FROM camera_mappings WHERE camera_id = ?')
      .bind(cameraId)
      .first<CameraMapping>();
    
    return result || null;
  }

  /**
   * Get all camera mappings for a station
   * Requirements: 2.2
   */
  async getByStationId(stationId: string): Promise<CameraMapping[]> {
    const result = await this.db
      .prepare('SELECT * FROM camera_mappings WHERE station_id = ? ORDER BY created_at DESC')
      .bind(stationId)
      .all<CameraMapping>();
    
    return result.results || [];
  }


  /**
   * Create a new camera mapping
   * Requirements: 2.1
   */
  async create(input: CreateCameraMappingInput): Promise<CameraMapping> {
    const now = getCurrentTimestamp();
    
    const mapping: CameraMapping = {
      camera_id: input.camera_id,
      station_id: input.station_id,
      rtsp_url: input.rtsp_url,
      name: input.name ?? null,
      created_at: now,
      updated_at: now,
    };

    await this.db
      .prepare(`
        INSERT INTO camera_mappings (camera_id, station_id, rtsp_url, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        mapping.camera_id,
        mapping.station_id,
        mapping.rtsp_url,
        mapping.name,
        mapping.created_at,
        mapping.updated_at
      )
      .run();

    return mapping;
  }

  /**
   * Update an existing camera mapping
   * Requirements: 2.3
   */
  async update(cameraId: string, input: UpdateCameraMappingInput): Promise<CameraMapping | null> {
    // First check if mapping exists
    const existing = await this.getById(cameraId);
    if (!existing) {
      return null;
    }

    const now = getCurrentTimestamp();
    
    // Build update fields
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (input.station_id !== undefined) {
      updates.push('station_id = ?');
      values.push(input.station_id);
    }
    if (input.rtsp_url !== undefined) {
      updates.push('rtsp_url = ?');
      values.push(input.rtsp_url);
    }
    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name ?? null);
    }

    // Always update updated_at
    updates.push('updated_at = ?');
    values.push(now);

    // Add camera_id for WHERE clause
    values.push(cameraId);

    await this.db
      .prepare(`UPDATE camera_mappings SET ${updates.join(', ')} WHERE camera_id = ?`)
      .bind(...values)
      .run();

    // Return updated mapping
    return this.getById(cameraId);
  }

  /**
   * Delete a camera mapping
   * Requirements: 2.4
   */
  async delete(cameraId: string): Promise<boolean> {
    // Check if mapping exists
    const existing = await this.getById(cameraId);
    if (!existing) {
      return false;
    }

    // Delete mapping (vision_detections and camera_health will cascade delete due to FK constraint)
    await this.db
      .prepare('DELETE FROM camera_mappings WHERE camera_id = ?')
      .bind(cameraId)
      .run();

    return true;
  }

  /**
   * Check if a camera mapping exists
   */
  async exists(cameraId: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT 1 FROM camera_mappings WHERE camera_id = ? LIMIT 1')
      .bind(cameraId)
      .first();
    
    return result !== null;
  }
}
