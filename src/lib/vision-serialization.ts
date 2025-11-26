/**
 * HeySalad QC - Vision Detection Serialization/Deserialization Utilities
 * 
 * Implements JSON serialization for VisionDetection and related types.
 * Requirements: 3.5, 3.6
 */

import type {
  VisionDetection,
  VisionDetectedObject,
  VisionBoundingBox,
  CameraMapping,
  CameraHealth,
  CameraStatus
} from '../types';

// =============================================================================
// VisionDetection Serialization (Requirements 3.5, 3.6)
// =============================================================================

/**
 * Serializes a VisionDetection object to JSON string
 * Output contains: id, camera_id, station_id, timestamp, objects, thumbnail_key, processing_time_ms
 */
export function serializeVisionDetection(detection: VisionDetection): string {
  return JSON.stringify({
    id: detection.id,
    camera_id: detection.camera_id,
    station_id: detection.station_id,
    timestamp: detection.timestamp,
    objects: detection.objects,
    thumbnail_key: detection.thumbnail_key,
    processing_time_ms: detection.processing_time_ms
  });
}

/**
 * Deserializes a JSON string to a VisionDetection object
 * @throws Error if JSON is invalid or missing required fields
 */
export function deserializeVisionDetection(json: string): VisionDetection {
  const data = JSON.parse(json);
  
  if (typeof data.id !== 'string') throw new Error('VisionDetection id must be a string');
  if (typeof data.camera_id !== 'string') throw new Error('VisionDetection camera_id must be a string');
  if (typeof data.station_id !== 'string') throw new Error('VisionDetection station_id must be a string');
  if (typeof data.timestamp !== 'string') throw new Error('VisionDetection timestamp must be a string');
  if (!Array.isArray(data.objects)) throw new Error('VisionDetection objects must be an array');
  if (typeof data.processing_time_ms !== 'number') throw new Error('VisionDetection processing_time_ms must be a number');
  
  const objects: VisionDetectedObject[] = data.objects.map((obj: unknown, index: number) => {
    return deserializeVisionDetectedObject(obj, index);
  });
  
  return {
    id: data.id,
    camera_id: data.camera_id,
    station_id: data.station_id,
    timestamp: data.timestamp,
    objects,
    thumbnail_key: data.thumbnail_key ?? null,
    processing_time_ms: data.processing_time_ms
  };
}

/**
 * Deserializes a single VisionDetectedObject from parsed JSON
 */
function deserializeVisionDetectedObject(obj: unknown, index: number): VisionDetectedObject {
  const o = obj as Record<string, unknown>;
  
  if (typeof o.label !== 'string') {
    throw new Error(`VisionDetectedObject [${index}] label must be a string`);
  }
  if (typeof o.confidence !== 'number') {
    throw new Error(`VisionDetectedObject [${index}] confidence must be a number`);
  }
  if (!o.bbox || typeof o.bbox !== 'object') {
    throw new Error(`VisionDetectedObject [${index}] bbox must be an object`);
  }
  
  const bbox = o.bbox as Record<string, unknown>;
  if (typeof bbox.x !== 'number' || typeof bbox.y !== 'number' ||
      typeof bbox.width !== 'number' || typeof bbox.height !== 'number') {
    throw new Error(`VisionDetectedObject [${index}] bbox must have x, y, width, height as numbers`);
  }
  
  return {
    label: o.label,
    confidence: o.confidence,
    bbox: {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height
    }
  };
}

// =============================================================================
// CameraMapping Serialization
// =============================================================================

/**
 * Serializes a CameraMapping object to JSON string
 */
export function serializeCameraMapping(mapping: CameraMapping): string {
  return JSON.stringify({
    camera_id: mapping.camera_id,
    station_id: mapping.station_id,
    rtsp_url: mapping.rtsp_url,
    name: mapping.name,
    created_at: mapping.created_at,
    updated_at: mapping.updated_at
  });
}

/**
 * Deserializes a JSON string to a CameraMapping object
 * @throws Error if JSON is invalid or missing required fields
 */
export function deserializeCameraMapping(json: string): CameraMapping {
  const data = JSON.parse(json);
  
  if (typeof data.camera_id !== 'string') throw new Error('CameraMapping camera_id must be a string');
  if (typeof data.station_id !== 'string') throw new Error('CameraMapping station_id must be a string');
  if (typeof data.rtsp_url !== 'string') throw new Error('CameraMapping rtsp_url must be a string');
  if (typeof data.created_at !== 'string') throw new Error('CameraMapping created_at must be a string');
  if (typeof data.updated_at !== 'string') throw new Error('CameraMapping updated_at must be a string');
  
  return {
    camera_id: data.camera_id,
    station_id: data.station_id,
    rtsp_url: data.rtsp_url,
    name: data.name ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

// =============================================================================
// CameraHealth Serialization
// =============================================================================

const VALID_CAMERA_STATUSES: CameraStatus[] = ['online', 'offline', 'error', 'unknown'];

/**
 * Serializes a CameraHealth object to JSON string
 */
export function serializeCameraHealth(health: CameraHealth): string {
  return JSON.stringify({
    camera_id: health.camera_id,
    last_frame_at: health.last_frame_at,
    error_count: health.error_count,
    last_error: health.last_error,
    status: health.status
  });
}

/**
 * Deserializes a JSON string to a CameraHealth object
 * @throws Error if JSON is invalid or missing required fields
 */
export function deserializeCameraHealth(json: string): CameraHealth {
  const data = JSON.parse(json);
  
  if (typeof data.camera_id !== 'string') throw new Error('CameraHealth camera_id must be a string');
  if (typeof data.error_count !== 'number') throw new Error('CameraHealth error_count must be a number');
  if (typeof data.status !== 'string' || !VALID_CAMERA_STATUSES.includes(data.status)) {
    throw new Error('CameraHealth status must be one of: online, offline, error, unknown');
  }
  
  return {
    camera_id: data.camera_id,
    last_frame_at: data.last_frame_at ?? null,
    error_count: data.error_count,
    last_error: data.last_error ?? null,
    status: data.status as CameraStatus
  };
}
