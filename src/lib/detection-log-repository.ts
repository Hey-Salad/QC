/**
 * HeySalad QC - Detection Log Repository
 * 
 * Implements create and query operations for detection_logs table.
 * Supports filtering by station_id with limit.
 * Requirements: 3.5
 */

import type { DetectionLogEntry, DetectedObject } from '../types';
import { generateUUID, getCurrentTimestamp } from './station-repository';

/**
 * Default limit for log queries
 */
const DEFAULT_LIMIT = 20;

/**
 * Input for creating a detection log entry
 */
export interface CreateDetectionLogInput {
  station_id: string;
  detected_items: DetectedObject[];
  confidence_scores: Record<string, number>;
  pass_fail: 'pass' | 'fail';
  image_url?: string | null;
}

/**
 * Detection log repository for D1 database operations
 */
export class DetectionLogRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Get detection logs for a station with optional limit
   * Requirements: 3.5, 5.7
   * 
   * @param stationId - The station ID to filter by
   * @param limit - Maximum number of logs to return (default 20)
   * @returns Array of detection log entries, ordered by timestamp descending
   */
  async getByStationId(stationId: string, limit: number = DEFAULT_LIMIT): Promise<DetectionLogEntry[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM detection_logs 
        WHERE station_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `)
      .bind(stationId, limit)
      .all<{
        id: string;
        station_id: string;
        detected_items: string;
        confidence_scores: string | null;
        pass_fail: 'pass' | 'fail';
        image_url: string | null;
        timestamp: string;
      }>();

    return (result.results || []).map(row => this.parseDetectionLogRow(row));
  }

  /**
   * Get a single detection log by ID
   */
  async getById(id: string): Promise<DetectionLogEntry | null> {
    const result = await this.db
      .prepare('SELECT * FROM detection_logs WHERE id = ?')
      .bind(id)
      .first<{
        id: string;
        station_id: string;
        detected_items: string;
        confidence_scores: string | null;
        pass_fail: 'pass' | 'fail';
        image_url: string | null;
        timestamp: string;
      }>();

    if (!result) {
      return null;
    }

    return this.parseDetectionLogRow(result);
  }

  /**
   * Create a new detection log entry
   * Requirements: 3.5
   */
  async create(input: CreateDetectionLogInput): Promise<DetectionLogEntry> {
    const id = generateUUID();
    const now = getCurrentTimestamp();

    await this.db
      .prepare(`
        INSERT INTO detection_logs (id, station_id, detected_items, confidence_scores, pass_fail, image_url, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        input.station_id,
        JSON.stringify(input.detected_items),
        JSON.stringify(input.confidence_scores),
        input.pass_fail,
        input.image_url ?? null,
        now
      )
      .run();

    return {
      id,
      station_id: input.station_id,
      detected_items: input.detected_items,
      confidence_scores: input.confidence_scores,
      pass_fail: input.pass_fail,
      image_url: input.image_url ?? null,
      timestamp: now
    };
  }

  /**
   * Delete all detection logs for a station
   */
  async deleteByStationId(stationId: string): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM detection_logs WHERE station_id = ?')
      .bind(stationId)
      .run();

    return result.meta.changes ?? 0;
  }

  /**
   * Count detection logs for a station
   */
  async countByStationId(stationId: string): Promise<number> {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM detection_logs WHERE station_id = ?')
      .bind(stationId)
      .first<{ count: number }>();

    return result?.count ?? 0;
  }

  /**
   * Parse a database row into a DetectionLogEntry object
   */
  private parseDetectionLogRow(row: {
    id: string;
    station_id: string;
    detected_items: string;
    confidence_scores: string | null;
    pass_fail: 'pass' | 'fail';
    image_url: string | null;
    timestamp: string;
  }): DetectionLogEntry {
    let detectedItems: DetectedObject[] = [];
    let confidenceScores: Record<string, number> = {};

    try {
      detectedItems = JSON.parse(row.detected_items);
    } catch {
      detectedItems = [];
    }

    try {
      if (row.confidence_scores) {
        confidenceScores = JSON.parse(row.confidence_scores);
      }
    } catch {
      confidenceScores = {};
    }

    return {
      id: row.id,
      station_id: row.station_id,
      detected_items: detectedItems,
      confidence_scores: confidenceScores,
      pass_fail: row.pass_fail,
      image_url: row.image_url,
      timestamp: row.timestamp
    };
  }
}
