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
// Cloud Vision Integration Types (Requirements 2.1, 3.4, 4.1, 5.3)
// =============================================================================

/** Camera to station mapping */
export interface CameraMapping {
  camera_id: string;
  station_id: string;
  rtsp_url: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new camera mapping */
export interface CreateCameraMappingInput {
  camera_id: string;
  station_id: string;
  rtsp_url: string;
  name?: string;
}

/** Input for updating a camera mapping */
export interface UpdateCameraMappingInput {
  station_id?: string;
  rtsp_url?: string;
  name?: string;
}

/** Bounding box for vision detection (normalized 0-1 coordinates) */
export interface VisionBoundingBox {
  x: number;      // 0-1 normalized
  y: number;      // 0-1 normalized
  width: number;  // 0-1 normalized
  height: number; // 0-1 normalized
}

/** A detected object from Workers AI vision detection */
export interface VisionDetectedObject {
  label: string;
  confidence: number;
  bbox: VisionBoundingBox;
}

/** Vision detection result stored in database */
export interface VisionDetection {
  id: string;
  camera_id: string;
  station_id: string;
  timestamp: string;
  objects: VisionDetectedObject[];
  thumbnail_key: string | null;
  processing_time_ms: number;
}

/** Camera health status */
export type CameraStatus = 'online' | 'offline' | 'error' | 'unknown';

/** Camera health tracking */
export interface CameraHealth {
  camera_id: string;
  last_frame_at: string | null;
  error_count: number;
  last_error: string | null;
  status: CameraStatus;
}

/** API response for latest detection */
export interface LatestDetectionResponse {
  detection: VisionDetection;
  thumbnail_url: string;
  camera: CameraMapping;
}

/** Response from vision detection API */
export interface VisionDetectResponse {
  success: boolean;
  detection_id: string;
  station_id: string;
  timestamp: string;
  objects: VisionDetectedObject[];
  thumbnail_url: string;
  processing_time_ms: number;
}

/** Camera health response */
export interface CameraHealthResponse {
  cameras: Array<CameraHealth & { camera_name: string | null }>;
}

// =============================================================================
// Environment Types
// =============================================================================

/** Cloudflare Worker environment bindings */
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  VISION_THUMBNAILS?: R2Bucket;
  AI?: Ai;
  ALLOWED_ORIGINS: string;
  VISION_API_KEY?: string;
}
