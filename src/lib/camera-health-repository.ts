/**
 * HeySalad QC - Camera Health Repository
 * 
 * Implements health tracking operations for cameras in the Cloud Vision system.
 * Handles last frame timestamps, error counts, and offline detection.
 * Requirements: 5.3, 5.4
 */

import type { CameraHealth, CameraStatus } from '../types';
import { getCurrentTimestamp } from './station-repository';

/**
 * Database row structure for camera_health table
 */
interface CameraHealthRow {
  camera_id: string;
  last_frame_at: string | null;
  error_count: number;
  last_error: string | null;
  status: CameraStatus;
}

/**
 * Offline timeout in seconds (60 seconds as per Requirement 5.4)
 */
export const OFFLINE_TIMEOUT_SECONDS = 60;

/**
 * Calculate camera status based on last frame timestamp
 * Requirements: 5.4
 * 
 * @param lastFrameAt - ISO timestamp of last frame, or null if never received
 * @param errorCount - Number of errors recorded
 * @param currentTime - Current time for comparison (defaults to now)
 * @returns Camera status: 'online', 'offline', 'error', or 'unknown'
 */
export function calculateCameraStatus(
  lastFrameAt: string | null,
  errorCount: number,
  currentTime: Date = new Date()
): CameraStatus {
  // If there are errors, status is 'error'
  if (errorCount > 0) {
    return 'error';
  }
  
  // If no frames ever received, status is 'unknown'
  if (!lastFrameAt) {
    return 'unknown';
  }
  
  // Calculate time since last frame
  const lastFrameTime = new Date(lastFrameAt);
  const secondsSinceLastFrame = (currentTime.getTime() - lastFrameTime.getTime()) / 1000;
  
  // If more than 60 seconds since last frame, status is 'offline'
  if (secondsSinceLastFrame > OFFLINE_TIMEOUT_SECONDS) {
    return 'offline';
  }
  
  return 'online';
}

/**
 * Camera health repository for D1 database operations
 */
export class CameraHealthRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }


  /**
   * Convert a database row to a CameraHealth object with calculated status
   */
  private rowToHealth(row: CameraHealthRow, currentTime?: Date): CameraHealth {
    const status = calculateCameraStatus(row.last_frame_at, row.error_count, currentTime);
    
    return {
      camera_id: row.camera_id,
      last_frame_at: row.last_frame_at,
      error_count: row.error_count,
      last_error: row.last_error,
      status,
    };
  }

  /**
   * Ensure a health record exists for a camera (upsert pattern)
   */
  private async ensureHealthRecord(cameraId: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR IGNORE INTO camera_health (camera_id, error_count, status)
        VALUES (?, 0, 'unknown')
      `)
      .bind(cameraId)
      .run();
  }

  /**
   * Update the last_frame_at timestamp for a camera
   * Requirements: 5.3
   * 
   * @param cameraId - The camera ID to update
   * @param timestamp - Optional timestamp (defaults to current time)
   * @returns The updated CameraHealth record
   */
  async updateLastFrame(cameraId: string, timestamp?: string): Promise<CameraHealth> {
    const frameTime = timestamp ?? getCurrentTimestamp();
    
    // Ensure record exists
    await this.ensureHealthRecord(cameraId);
    
    // Update last_frame_at and reset error count (successful frame clears errors)
    await this.db
      .prepare(`
        UPDATE camera_health 
        SET last_frame_at = ?, error_count = 0, last_error = NULL, status = 'online'
        WHERE camera_id = ?
      `)
      .bind(frameTime, cameraId)
      .run();
    
    // Return updated health
    const health = await this.getHealth(cameraId);
    return health!;
  }

  /**
   * Increment error count and record error message
   * Requirements: 5.3
   * 
   * @param cameraId - The camera ID to update
   * @param errorMessage - Optional error message to record
   * @returns The updated CameraHealth record
   */
  async incrementErrorCount(cameraId: string, errorMessage?: string): Promise<CameraHealth> {
    // Ensure record exists
    await this.ensureHealthRecord(cameraId);
    
    // Increment error count and update status
    await this.db
      .prepare(`
        UPDATE camera_health 
        SET error_count = error_count + 1, 
            last_error = ?,
            status = 'error'
        WHERE camera_id = ?
      `)
      .bind(errorMessage ?? null, cameraId)
      .run();
    
    // Return updated health
    const health = await this.getHealth(cameraId);
    return health!;
  }

  /**
   * Get health status for a specific camera
   * Requirements: 5.3
   * 
   * @param cameraId - The camera ID to query
   * @param currentTime - Optional current time for status calculation
   * @returns CameraHealth record or null if not found
   */
  async getHealth(cameraId: string, currentTime?: Date): Promise<CameraHealth | null> {
    const result = await this.db
      .prepare('SELECT * FROM camera_health WHERE camera_id = ?')
      .bind(cameraId)
      .first<CameraHealthRow>();
    
    if (!result) {
      return null;
    }
    
    return this.rowToHealth(result, currentTime);
  }

  /**
   * Get health status for all cameras
   * Requirements: 5.3
   * 
   * @param currentTime - Optional current time for status calculation
   * @returns Array of CameraHealth records
   */
  async getAllHealth(currentTime?: Date): Promise<CameraHealth[]> {
    const result = await this.db
      .prepare('SELECT * FROM camera_health ORDER BY camera_id')
      .all<CameraHealthRow>();
    
    return (result.results || []).map(row => this.rowToHealth(row, currentTime));
  }

  /**
   * Reset error count for a camera
   * 
   * @param cameraId - The camera ID to reset
   * @returns true if reset was successful, false if camera not found
   */
  async resetErrors(cameraId: string): Promise<boolean> {
    const existing = await this.getHealth(cameraId);
    if (!existing) {
      return false;
    }
    
    await this.db
      .prepare(`
        UPDATE camera_health 
        SET error_count = 0, last_error = NULL
        WHERE camera_id = ?
      `)
      .bind(cameraId)
      .run();
    
    return true;
  }

  /**
   * Delete health record for a camera
   * 
   * @param cameraId - The camera ID to delete
   * @returns true if deleted, false if not found
   */
  async delete(cameraId: string): Promise<boolean> {
    const existing = await this.getHealth(cameraId);
    if (!existing) {
      return false;
    }
    
    await this.db
      .prepare('DELETE FROM camera_health WHERE camera_id = ?')
      .bind(cameraId)
      .run();
    
    return true;
  }
}
