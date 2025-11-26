/**
 * HeySalad QC - Vision Detection Repository
 * 
 * Implements storage and retrieval operations for vision detection results.
 * Handles detection storage, latest detection queries, and pagination.
 * Requirements: 4.1, 4.2
 */

import type { VisionDetection, VisionDetectedObject } from '../types';
import { generateUUID, getCurrentTimestamp } from './station-repository';

/**
 * Database row structure for vision_detections table
 */
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

/**
 * Input for creating a new vision detection
 */
export interface CreateVisionDetectionInput {
  camera_id: string;
  station_id: string;
  objects: VisionDetectedObject[];
  thumbnail_key?: string;
  processing_time_ms: number;
  timestamp?: string;
}

/**
 * Pagination options for detection history queries
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Vision detection repository for D1 database operations
 */
export class VisionDetectionRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }


  /**
   * Convert a database row to a VisionDetection object
   */
  private rowToDetection(row: VisionDetectionRow): VisionDetection {
    let objects: VisionDetectedObject[] = [];
    try {
      objects = JSON.parse(row.objects_json);
    } catch {
      objects = [];
    }

    return {
      id: row.id,
      camera_id: row.camera_id,
      station_id: row.station_id,
      timestamp: row.timestamp,
      objects,
      thumbnail_key: row.thumbnail_key,
      processing_time_ms: row.processing_time_ms ?? 0,
    };
  }

  /**
   * Store a new detection result
   * Requirements: 4.1
   */
  async create(input: CreateVisionDetectionInput): Promise<VisionDetection> {
    const id = generateUUID();
    const timestamp = input.timestamp ?? getCurrentTimestamp();
    const objectsJson = JSON.stringify(input.objects);

    const detection: VisionDetection = {
      id,
      camera_id: input.camera_id,
      station_id: input.station_id,
      timestamp,
      objects: input.objects,
      thumbnail_key: input.thumbnail_key ?? null,
      processing_time_ms: input.processing_time_ms,
    };

    await this.db
      .prepare(`
        INSERT INTO vision_detections (id, camera_id, station_id, timestamp, objects_json, thumbnail_key, processing_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        detection.id,
        detection.camera_id,
        detection.station_id,
        detection.timestamp,
        objectsJson,
        detection.thumbnail_key,
        detection.processing_time_ms
      )
      .run();

    return detection;
  }

  /**
   * Get the most recent detection for a station
   * Requirements: 4.2
   */
  async getLatestByStationId(stationId: string): Promise<VisionDetection | null> {
    const result = await this.db
      .prepare(`
        SELECT * FROM vision_detections 
        WHERE station_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `)
      .bind(stationId)
      .first<VisionDetectionRow>();

    if (!result) {
      return null;
    }

    return this.rowToDetection(result);
  }

  /**
   * Get detection history for a station with pagination
   * Requirements: 4.2
   */
  async getByStationId(
    stationId: string,
    options: PaginationOptions = {}
  ): Promise<{ detections: VisionDetection[]; total: number }> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    // Get total count
    const countResult = await this.db
      .prepare('SELECT COUNT(*) as count FROM vision_detections WHERE station_id = ?')
      .bind(stationId)
      .first<{ count: number }>();

    const total = countResult?.count ?? 0;

    // Get paginated results
    const result = await this.db
      .prepare(`
        SELECT * FROM vision_detections 
        WHERE station_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `)
      .bind(stationId, limit, offset)
      .all<VisionDetectionRow>();

    const detections = (result.results || []).map((row) => this.rowToDetection(row));

    return { detections, total };
  }

  /**
   * Get a detection by ID
   */
  async getById(id: string): Promise<VisionDetection | null> {
    const result = await this.db
      .prepare('SELECT * FROM vision_detections WHERE id = ?')
      .bind(id)
      .first<VisionDetectionRow>();

    if (!result) {
      return null;
    }

    return this.rowToDetection(result);
  }

  /**
   * Delete a detection by ID
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    await this.db
      .prepare('DELETE FROM vision_detections WHERE id = ?')
      .bind(id)
      .run();

    return true;
  }

  /**
   * Delete all detections for a station
   */
  async deleteByStationId(stationId: string): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM vision_detections WHERE station_id = ?')
      .bind(stationId)
      .run();

    return result.meta.changes ?? 0;
  }
}
