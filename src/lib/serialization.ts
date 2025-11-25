/**
 * HeySalad QC - Serialization/Deserialization Utilities
 * 
 * Implements JSON serialization for Station, DetectionRules, DetectionResult.
 * Handles null/optional fields correctly.
 * Requirements: 8.1, 8.2, 8.4, 8.5
 */

import type {
  Station,
  DetectionRules,
  DetectionResult,
  DetectedObject,
  ExpectedItem,
  AlertConfig,
  AlertTrigger,
  BoundingBox,
  StationType
} from '../types';

// =============================================================================
// Station Serialization (Requirements 8.1)
// =============================================================================

/**
 * Serializes a Station object to JSON string
 * Output contains: id, name, type, location, description, qr_code_url, created_at, updated_at
 */
export function serializeStation(station: Station): string {
  return JSON.stringify({
    id: station.id,
    name: station.name,
    type: station.type,
    location: station.location,
    description: station.description,
    qr_code_url: station.qr_code_url,
    created_at: station.created_at,
    updated_at: station.updated_at
  });
}

/**
 * Deserializes a JSON string to a Station object
 * @throws Error if JSON is invalid or missing required fields
 */
export function deserializeStation(json: string): Station {
  const data = JSON.parse(json);
  
  if (typeof data.id !== 'string') throw new Error('Station id must be a string');
  if (typeof data.name !== 'string') throw new Error('Station name must be a string');
  if (typeof data.type !== 'string') throw new Error('Station type must be a string');
  if (typeof data.created_at !== 'string') throw new Error('Station created_at must be a string');
  if (typeof data.updated_at !== 'string') throw new Error('Station updated_at must be a string');
  
  return {
    id: data.id,
    name: data.name,
    type: data.type as StationType,
    location: data.location ?? null,
    description: data.description ?? null,
    qr_code_url: data.qr_code_url ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}


// =============================================================================
// Detection Rules Serialization (Requirements 8.4)
// =============================================================================

/**
 * Serializes a DetectionRules object to JSON string
 * Output contains: expected_items array, confidence_threshold, alert_config object
 */
export function serializeDetectionRules(rules: DetectionRules): string {
  return JSON.stringify({
    id: rules.id,
    station_id: rules.station_id,
    expected_items: rules.expected_items,
    confidence_threshold: rules.confidence_threshold,
    alert_config: rules.alert_config,
    created_at: rules.created_at
  });
}

/**
 * Deserializes a JSON string to a DetectionRules object
 * @throws Error if JSON is invalid or missing required fields
 */
export function deserializeDetectionRules(json: string): DetectionRules {
  const data = JSON.parse(json);
  
  if (typeof data.id !== 'string') throw new Error('DetectionRules id must be a string');
  if (typeof data.station_id !== 'string') throw new Error('DetectionRules station_id must be a string');
  if (!Array.isArray(data.expected_items)) throw new Error('DetectionRules expected_items must be an array');
  if (typeof data.confidence_threshold !== 'number') throw new Error('DetectionRules confidence_threshold must be a number');
  if (typeof data.created_at !== 'string') throw new Error('DetectionRules created_at must be a string');
  
  const expectedItems: ExpectedItem[] = data.expected_items.map((item: unknown, index: number) => {
    const i = item as Record<string, unknown>;
    if (typeof i.label !== 'string') throw new Error(`Expected item [${index}] label must be a string`);
    if (typeof i.required !== 'boolean') throw new Error(`Expected item [${index}] required must be a boolean`);
    return {
      label: i.label,
      required: i.required,
      min_confidence: typeof i.min_confidence === 'number' ? i.min_confidence : undefined
    };
  });
  
  const alertConfig = deserializeAlertConfig(data.alert_config);
  
  return {
    id: data.id,
    station_id: data.station_id,
    expected_items: expectedItems,
    confidence_threshold: data.confidence_threshold,
    alert_config: alertConfig,
    created_at: data.created_at
  };
}

/**
 * Deserializes alert config from parsed JSON
 */
function deserializeAlertConfig(data: unknown): AlertConfig {
  if (!data || typeof data !== 'object') {
    return { enabled: false, triggers: [] };
  }
  
  const config = data as Record<string, unknown>;
  
  return {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : false,
    email: typeof config.email === 'string' ? config.email : undefined,
    slack_webhook: typeof config.slack_webhook === 'string' ? config.slack_webhook : undefined,
    sms: typeof config.sms === 'string' ? config.sms : undefined,
    triggers: Array.isArray(config.triggers) 
      ? config.triggers.filter((t): t is AlertTrigger => 
          ['missing_item', 'low_confidence', 'all_failures'].includes(t as string))
      : []
  };
}


// =============================================================================
// Detection Result Serialization (Requirements 8.2)
// =============================================================================

/**
 * Serializes a DetectionResult object to JSON string
 * Output contains: detected_objects array, expected_objects array, timestamp, pass boolean, missing array
 */
export function serializeDetectionResult(result: DetectionResult): string {
  return JSON.stringify({
    detected_objects: result.detected_objects,
    expected_objects: result.expected_objects,
    timestamp: result.timestamp,
    pass: result.pass,
    missing: result.missing
  });
}

/**
 * Deserializes a JSON string to a DetectionResult object
 * @throws Error if JSON is invalid or missing required fields
 */
export function deserializeDetectionResult(json: string): DetectionResult {
  const data = JSON.parse(json);
  
  if (!Array.isArray(data.detected_objects)) throw new Error('DetectionResult detected_objects must be an array');
  if (!Array.isArray(data.expected_objects)) throw new Error('DetectionResult expected_objects must be an array');
  if (typeof data.timestamp !== 'string') throw new Error('DetectionResult timestamp must be a string');
  if (typeof data.pass !== 'boolean') throw new Error('DetectionResult pass must be a boolean');
  if (!Array.isArray(data.missing)) throw new Error('DetectionResult missing must be an array');
  
  const detectedObjects: DetectedObject[] = data.detected_objects.map((obj: unknown, index: number) => {
    const o = obj as Record<string, unknown>;
    if (typeof o.label !== 'string') throw new Error(`Detected object [${index}] label must be a string`);
    if (typeof o.confidence !== 'number') throw new Error(`Detected object [${index}] confidence must be a number`);
    if (!Array.isArray(o.bbox) || o.bbox.length !== 4) throw new Error(`Detected object [${index}] bbox must be array of 4 numbers`);
    
    return {
      label: o.label,
      confidence: o.confidence,
      bbox: o.bbox as BoundingBox
    };
  });
  
  return {
    detected_objects: detectedObjects,
    expected_objects: data.expected_objects.map((e: unknown) => String(e)),
    timestamp: data.timestamp,
    pass: data.pass,
    missing: data.missing.map((m: unknown) => String(m))
  };
}

// =============================================================================
// Generic JSON Utilities
// =============================================================================

/**
 * Safely parses JSON, returning null on failure
 */
export function safeParseJSON<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Checks if a value is a valid JSON string
 */
export function isValidJSON(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
