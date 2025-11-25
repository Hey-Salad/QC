/**
 * HeySalad QC - Detection Rules Repository
 * 
 * Implements CRUD operations for detection_rules table using D1 database.
 * Handles JSON serialization for expected_items and alert_config.
 * Requirements: 4.6
 */

import type { DetectionRules, DetectionRulesInput, ExpectedItem, AlertConfig } from '../types';
import { generateUUID, getCurrentTimestamp } from './station-repository';

/**
 * Default alert configuration
 */
const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: false,
  triggers: []
};

/**
 * Default confidence threshold
 */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Detection rules repository for D1 database operations
 */
export class DetectionRulesRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Get detection rules for a station
   * Requirements: 5.8
   */
  async getByStationId(stationId: string): Promise<DetectionRules | null> {
    const result = await this.db
      .prepare('SELECT * FROM detection_rules WHERE station_id = ?')
      .bind(stationId)
      .first<{
        id: string;
        station_id: string;
        expected_items: string;
        confidence_threshold: number;
        alert_config: string | null;
        created_at: string;
      }>();

    if (!result) {
      return null;
    }

    return this.parseDetectionRulesRow(result);
  }

  /**
   * Create detection rules for a station
   * Requirements: 4.6
   */
  async create(stationId: string, input: DetectionRulesInput): Promise<DetectionRules> {
    const id = generateUUID();
    const now = getCurrentTimestamp();

    const expectedItems = input.expected_items;
    const confidenceThreshold = input.confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    const alertConfig = input.alert_config ?? DEFAULT_ALERT_CONFIG;

    await this.db
      .prepare(`
        INSERT INTO detection_rules (id, station_id, expected_items, confidence_threshold, alert_config, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        stationId,
        JSON.stringify(expectedItems),
        confidenceThreshold,
        JSON.stringify(alertConfig),
        now
      )
      .run();

    return {
      id,
      station_id: stationId,
      expected_items: expectedItems,
      confidence_threshold: confidenceThreshold,
      alert_config: alertConfig,
      created_at: now
    };
  }

  /**
   * Update detection rules for a station (upsert)
   * Requirements: 5.8
   */
  async upsert(stationId: string, input: DetectionRulesInput): Promise<DetectionRules> {
    const existing = await this.getByStationId(stationId);

    if (existing) {
      return this.update(stationId, input);
    } else {
      return this.create(stationId, input);
    }
  }

  /**
   * Update existing detection rules
   * Requirements: 5.8
   */
  async update(stationId: string, input: DetectionRulesInput): Promise<DetectionRules> {
    const existing = await this.getByStationId(stationId);
    
    if (!existing) {
      throw new Error(`Detection rules not found for station ${stationId}`);
    }

    const expectedItems = input.expected_items;
    const confidenceThreshold = input.confidence_threshold ?? existing.confidence_threshold;
    const alertConfig = input.alert_config ?? existing.alert_config;

    await this.db
      .prepare(`
        UPDATE detection_rules 
        SET expected_items = ?, confidence_threshold = ?, alert_config = ?
        WHERE station_id = ?
      `)
      .bind(
        JSON.stringify(expectedItems),
        confidenceThreshold,
        JSON.stringify(alertConfig),
        stationId
      )
      .run();

    return {
      ...existing,
      expected_items: expectedItems,
      confidence_threshold: confidenceThreshold,
      alert_config: alertConfig
    };
  }

  /**
   * Delete detection rules for a station
   */
  async delete(stationId: string): Promise<boolean> {
    const existing = await this.getByStationId(stationId);
    if (!existing) {
      return false;
    }

    await this.db
      .prepare('DELETE FROM detection_rules WHERE station_id = ?')
      .bind(stationId)
      .run();

    return true;
  }

  /**
   * Parse a database row into a DetectionRules object
   */
  private parseDetectionRulesRow(row: {
    id: string;
    station_id: string;
    expected_items: string;
    confidence_threshold: number;
    alert_config: string | null;
    created_at: string;
  }): DetectionRules {
    let expectedItems: ExpectedItem[] = [];
    let alertConfig: AlertConfig = DEFAULT_ALERT_CONFIG;

    try {
      expectedItems = JSON.parse(row.expected_items);
    } catch {
      expectedItems = [];
    }

    try {
      if (row.alert_config) {
        alertConfig = JSON.parse(row.alert_config);
      }
    } catch {
      alertConfig = DEFAULT_ALERT_CONFIG;
    }

    return {
      id: row.id,
      station_id: row.station_id,
      expected_items: expectedItems,
      confidence_threshold: row.confidence_threshold,
      alert_config: alertConfig,
      created_at: row.created_at
    };
  }
}
