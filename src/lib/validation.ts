/**
 * HeySalad QC - Validation Utility Functions
 * 
 * Implements validation for station inputs, detection rules, and UUIDs.
 * Requirements: 4.2, 8.3
 */

import type { StationType } from '../types';

// =============================================================================
// Validation Result Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// =============================================================================
// Constants
// =============================================================================

const VALID_STATION_TYPES: StationType[] = ['packing', 'prep', 'storage', 'receiving'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATION_VALIDATION = {
  name: { minLength: 1, maxLength: 100 },
  location: { maxLength: 200 },
  description: { maxLength: 500 },
};

// =============================================================================
// UUID Validation
// =============================================================================

/**
 * Validates a UUID string format
 * @param uuid - The string to validate
 * @returns true if valid UUID format, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  if (typeof uuid !== 'string') return false;
  return UUID_REGEX.test(uuid);
}

// =============================================================================
// Station Validation
// =============================================================================

/**
 * Validates a station type value
 * @param type - The type to validate
 * @returns true if valid station type
 */
export function isValidStationType(type: unknown): type is StationType {
  return typeof type === 'string' && VALID_STATION_TYPES.includes(type as StationType);
}


/**
 * Validates station name
 * @param name - The name to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateStationName(name: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (name === undefined || name === null) {
    errors.push('Name is required');
  } else if (typeof name !== 'string') {
    errors.push('Name must be a string');
  } else {
    const trimmed = name.trim();
    if (trimmed.length < STATION_VALIDATION.name.minLength) {
      errors.push(`Name must be at least ${STATION_VALIDATION.name.minLength} character(s)`);
    }
    if (trimmed.length > STATION_VALIDATION.name.maxLength) {
      errors.push(`Name must be at most ${STATION_VALIDATION.name.maxLength} characters`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates optional station location
 * @param location - The location to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateStationLocation(location: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (location !== undefined && location !== null) {
    if (typeof location !== 'string') {
      errors.push('Location must be a string');
    } else if (location.length > STATION_VALIDATION.location.maxLength) {
      errors.push(`Location must be at most ${STATION_VALIDATION.location.maxLength} characters`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates optional station description
 * @param description - The description to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateStationDescription(description: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push('Description must be a string');
    } else if (description.length > STATION_VALIDATION.description.maxLength) {
      errors.push(`Description must be at most ${STATION_VALIDATION.description.maxLength} characters`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a CreateStationInput object
 * @param input - The input to validate
 * @returns ValidationResult with all errors
 */
export function validateCreateStationInput(input: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  
  const data = input as Record<string, unknown>;
  
  // Validate name (required)
  const nameResult = validateStationName(data.name);
  errors.push(...nameResult.errors);
  
  // Validate type (required)
  if (data.type === undefined || data.type === null) {
    errors.push('Type is required');
  } else if (!isValidStationType(data.type)) {
    errors.push(`Type must be one of: ${VALID_STATION_TYPES.join(', ')}`);
  }
  
  // Validate location (optional)
  const locationResult = validateStationLocation(data.location);
  errors.push(...locationResult.errors);
  
  // Validate description (optional)
  const descriptionResult = validateStationDescription(data.description);
  errors.push(...descriptionResult.errors);
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an UpdateStationInput object
 * @param input - The input to validate
 * @returns ValidationResult with all errors
 */
export function validateUpdateStationInput(input: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  
  const data = input as Record<string, unknown>;
  
  // Validate name (optional for update)
  if (data.name !== undefined) {
    const nameResult = validateStationName(data.name);
    errors.push(...nameResult.errors);
  }
  
  // Validate type (optional for update)
  if (data.type !== undefined && !isValidStationType(data.type)) {
    errors.push(`Type must be one of: ${VALID_STATION_TYPES.join(', ')}`);
  }
  
  // Validate location (optional)
  const locationResult = validateStationLocation(data.location);
  errors.push(...locationResult.errors);
  
  // Validate description (optional)
  const descriptionResult = validateStationDescription(data.description);
  errors.push(...descriptionResult.errors);
  
  return { valid: errors.length === 0, errors };
}


// =============================================================================
// Confidence Threshold Validation (Requirements 4.2)
// =============================================================================

/**
 * Validates a confidence threshold value
 * Must be a number between 0.0 and 1.0 inclusive
 * @param threshold - The threshold value to validate
 * @returns true if valid, false otherwise
 */
export function isValidConfidenceThreshold(threshold: unknown): boolean {
  if (typeof threshold !== 'number') return false;
  if (Number.isNaN(threshold)) return false;
  return threshold >= 0.0 && threshold <= 1.0;
}

/**
 * Validates a confidence threshold with detailed result
 * @param threshold - The threshold value to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateConfidenceThreshold(threshold: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (threshold === undefined || threshold === null) {
    // Threshold is optional, default will be applied
    return { valid: true, errors: [] };
  }
  
  if (typeof threshold !== 'number') {
    errors.push('Confidence threshold must be a number');
  } else if (Number.isNaN(threshold)) {
    errors.push('Confidence threshold cannot be NaN');
  } else if (threshold < 0.0) {
    errors.push('Confidence threshold must be at least 0.0');
  } else if (threshold > 1.0) {
    errors.push('Confidence threshold must be at most 1.0');
  }
  
  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Expected Item Validation
// =============================================================================

/**
 * Validates an expected item object
 * @param item - The item to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateExpectedItem(item: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!item || typeof item !== 'object') {
    return { valid: false, errors: ['Expected item must be an object'] };
  }
  
  const data = item as Record<string, unknown>;
  
  // Validate label (required)
  if (data.label === undefined || data.label === null) {
    errors.push('Expected item label is required');
  } else if (typeof data.label !== 'string') {
    errors.push('Expected item label must be a string');
  } else if (data.label.trim().length === 0) {
    errors.push('Expected item label cannot be empty');
  }
  
  // Validate required (required boolean)
  if (data.required === undefined || data.required === null) {
    errors.push('Expected item required field is required');
  } else if (typeof data.required !== 'boolean') {
    errors.push('Expected item required must be a boolean');
  }
  
  // Validate min_confidence (optional)
  if (data.min_confidence !== undefined && data.min_confidence !== null) {
    if (!isValidConfidenceThreshold(data.min_confidence)) {
      errors.push('Expected item min_confidence must be a number between 0.0 and 1.0');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Alert Config Validation
// =============================================================================

const VALID_ALERT_TRIGGERS = ['missing_item', 'low_confidence', 'all_failures'];

/**
 * Validates an alert configuration object
 * @param config - The config to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateAlertConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (config === undefined || config === null) {
    return { valid: true, errors: [] };
  }
  
  if (typeof config !== 'object') {
    return { valid: false, errors: ['Alert config must be an object'] };
  }
  
  const data = config as Record<string, unknown>;
  
  // Validate enabled (required)
  if (data.enabled === undefined || data.enabled === null) {
    errors.push('Alert config enabled field is required');
  } else if (typeof data.enabled !== 'boolean') {
    errors.push('Alert config enabled must be a boolean');
  }
  
  // Validate email (optional)
  if (data.email !== undefined && data.email !== null && typeof data.email !== 'string') {
    errors.push('Alert config email must be a string');
  }
  
  // Validate slack_webhook (optional)
  if (data.slack_webhook !== undefined && data.slack_webhook !== null && typeof data.slack_webhook !== 'string') {
    errors.push('Alert config slack_webhook must be a string');
  }
  
  // Validate sms (optional)
  if (data.sms !== undefined && data.sms !== null && typeof data.sms !== 'string') {
    errors.push('Alert config sms must be a string');
  }
  
  // Validate triggers (required array)
  if (data.triggers === undefined || data.triggers === null) {
    errors.push('Alert config triggers is required');
  } else if (!Array.isArray(data.triggers)) {
    errors.push('Alert config triggers must be an array');
  } else {
    for (const trigger of data.triggers) {
      if (!VALID_ALERT_TRIGGERS.includes(trigger as string)) {
        errors.push(`Invalid alert trigger: ${trigger}. Must be one of: ${VALID_ALERT_TRIGGERS.join(', ')}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Detection Rules Validation
// =============================================================================

/**
 * Validates a DetectionRulesInput object
 * @param input - The input to validate
 * @returns ValidationResult with all errors
 */
export function validateDetectionRulesInput(input: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  
  const data = input as Record<string, unknown>;
  
  // Validate expected_items (required array)
  if (data.expected_items === undefined || data.expected_items === null) {
    errors.push('Expected items is required');
  } else if (!Array.isArray(data.expected_items)) {
    errors.push('Expected items must be an array');
  } else {
    for (let i = 0; i < data.expected_items.length; i++) {
      const itemResult = validateExpectedItem(data.expected_items[i]);
      for (const error of itemResult.errors) {
        errors.push(`Expected item [${i}]: ${error}`);
      }
    }
  }
  
  // Validate confidence_threshold (optional)
  const thresholdResult = validateConfidenceThreshold(data.confidence_threshold);
  errors.push(...thresholdResult.errors);
  
  // Validate alert_config (optional)
  const alertResult = validateAlertConfig(data.alert_config);
  errors.push(...alertResult.errors);
  
  return { valid: errors.length === 0, errors };
}


// =============================================================================
// Detection Request Validation (Requirements 5.6, 8.3)
// =============================================================================

/**
 * Validates a DetectionRequest object
 * @param input - The input to validate
 * @returns ValidationResult with all errors
 */
export function validateDetectionRequest(input: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  
  const data = input as Record<string, unknown>;
  
  // Validate station_id (required)
  if (data.station_id === undefined || data.station_id === null) {
    errors.push('station_id is required');
  } else if (typeof data.station_id !== 'string') {
    errors.push('station_id must be a string');
  } else if (data.station_id.trim().length === 0) {
    errors.push('station_id cannot be empty');
  }
  
  // Validate image_data (required)
  if (data.image_data === undefined || data.image_data === null) {
    errors.push('image_data is required');
  } else if (typeof data.image_data !== 'string') {
    errors.push('image_data must be a string');
  }
  
  return { valid: errors.length === 0, errors };
}
