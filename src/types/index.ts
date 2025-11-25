/// <reference types="@cloudflare/workers-types" />

/**
 * HeySalad QC - Shared TypeScript Types and Interfaces
 * 
 * This file contains all shared types for the HeySalad QC application,
 * including data models, API request/response types, and utility types.
 */

// =============================================================================
// Station Types (Requirements 8.1)
// =============================================================================

/** Station type categories */
export type StationType = 'packing' | 'prep' | 'storage' | 'receiving';

/** Station model - represents a QC checkpoint */
export interface Station {
  id: string;
  name: string;
  type: StationType;
  location: string | null;
  description: string | null;
  qr_code_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new station */
export interface CreateStationInput {
  name: string;
  type: StationType;
  location?: string;
  description?: string;
}

/** Input for updating an existing station */
export interface UpdateStationInput {
  name?: string;
  type?: StationType;
  location?: string;
  description?: string;
}

// =============================================================================
// Detection Rules Types (Requirements 8.4)
// =============================================================================

/** Alert trigger conditions */
export type AlertTrigger = 'missing_item' | 'low_confidence' | 'all_failures';

/** Alert configuration for a station */
export interface AlertConfig {
  enabled: boolean;
  email?: string;
  slack_webhook?: string;
  sms?: string;
  triggers: AlertTrigger[];
}

/** Expected item in detection rules */
export interface ExpectedItem {
  label: string;
  required: boolean;
  min_confidence?: number;
}

/** Detection rules for a station */
export interface DetectionRules {
  id: string;
  station_id: string;
  expected_items: ExpectedItem[];
  confidence_threshold: number;
  alert_config: AlertConfig;
  created_at: string;
}

/** Input for creating/updating detection rules */
export interface DetectionRulesInput {
  expected_items: ExpectedItem[];
  confidence_threshold?: number;
  alert_config?: AlertConfig;
}

// =============================================================================
// Detection Result Types (Requirements 8.2)
// =============================================================================

/** Bounding box coordinates [x, y, width, height] */
export type BoundingBox = [number, number, number, number];

/** A detected object from image analysis */
export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: BoundingBox;
}

/** Detection log entry stored in database */
export interface DetectionLogEntry {
  id: string;
  station_id: string;
  detected_items: DetectedObject[];
  confidence_scores: Record<string, number>;
  pass_fail: 'pass' | 'fail';
  image_url: string | null;
  timestamp: string;
}

/** Detection result returned from API */
export interface DetectionResult {
  detected_objects: DetectedObject[];
  expected_objects: string[];
  timestamp: string;
  pass: boolean;
  missing: string[];
}

// =============================================================================
// Mat Generation Types
// =============================================================================

/** Layout options for QC mat generation */
export type MatLayout = '1x1' | '2x1' | '2x2';

/** Request body for mat generation */
export interface MatGenerationRequest {
  station_id: string;
  layout: MatLayout;
}

/** Response from mat generation */
export interface MatGenerationResponse {
  url: string;
  filename: string;
}

// =============================================================================
// API Request/Response Types (Requirements 8.3)
// =============================================================================

/** Standard API error response */
export interface APIError {
  error: string;
  message: string;
  status: number;
  details?: Record<string, string>;
}

/** Detection request body */
export interface DetectionRequest {
  station_id: string;
  image_data: string;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// Environment Types
// =============================================================================

/** Cloudflare Worker environment bindings */
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ALLOWED_ORIGINS: string;
}
