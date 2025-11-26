/**
 * HeySalad QC - Checklist Comparison Logic
 * 
 * Compares expected items vs detected items.
 * Marks items as found/missing based on presence.
 * Flags failures for missing required items.
 * Requirements: 1.2, 3.4, 4.3
 */

import type { ExpectedItem, DetectedObject, VisionDetectedObject } from '../types';

/**
 * Result of comparing a single expected item against detected items
 */
export interface ChecklistItemResult {
  label: string;
  required: boolean;
  found: boolean;
  confidence: number | null;
}

/**
 * Overall checklist comparison result
 */
export interface ChecklistResult {
  items: ChecklistItemResult[];
  found: string[];
  missing: string[];
  pass: boolean;
}

/**
 * Compares expected items against detected items to produce a checklist result.
 * 
 * An item is considered "found" if it appears in both expected and detected sets.
 * An item is considered "missing" if it appears in expected but not in detected.
 * The overall result is "pass" only if all required items are found.
 * 
 * Requirements: 3.4, 4.3
 * 
 * @param expectedItems - Array of expected items with labels and required flags
 * @param detectedObjects - Array of detected objects with labels and confidence scores
 * @param confidenceThreshold - Minimum confidence required to consider an item detected (default 0.0)
 * @returns ChecklistResult with found/missing items and pass/fail status
 */
export function compareChecklist(
  expectedItems: ExpectedItem[],
  detectedObjects: DetectedObject[],
  confidenceThreshold: number = 0.0
): ChecklistResult {
  // Build a map of detected labels to their highest confidence score
  const detectedMap = new Map<string, number>();
  for (const obj of detectedObjects) {
    const normalizedLabel = obj.label.toLowerCase().trim();
    const existingConfidence = detectedMap.get(normalizedLabel) ?? 0;
    if (obj.confidence > existingConfidence) {
      detectedMap.set(normalizedLabel, obj.confidence);
    }
  }

  const items: ChecklistItemResult[] = [];
  const found: string[] = [];
  const missing: string[] = [];
  let allRequiredFound = true;

  for (const expected of expectedItems) {
    const normalizedLabel = expected.label.toLowerCase().trim();
    const detectedConfidence = detectedMap.get(normalizedLabel);
    
    // Item is found if it exists in detected set AND meets confidence threshold
    const itemFound = detectedConfidence !== undefined && detectedConfidence >= confidenceThreshold;
    
    items.push({
      label: expected.label,
      required: expected.required,
      found: itemFound,
      confidence: detectedConfidence ?? null
    });

    if (itemFound) {
      found.push(expected.label);
    } else {
      missing.push(expected.label);
      // If a required item is missing, the overall check fails
      if (expected.required) {
        allRequiredFound = false;
      }
    }
  }

  return {
    items,
    found,
    missing,
    pass: allRequiredFound
  };
}

/**
 * Simple comparison of expected labels vs detected labels.
 * Returns found and missing arrays.
 * 
 * @param expectedLabels - Array of expected item labels
 * @param detectedLabels - Array of detected item labels
 * @returns Object with found and missing arrays
 */
export function compareLabels(
  expectedLabels: string[],
  detectedLabels: string[]
): { found: string[]; missing: string[] } {
  const detectedSet = new Set(detectedLabels.map(l => l.toLowerCase().trim()));
  
  const found: string[] = [];
  const missing: string[] = [];

  for (const label of expectedLabels) {
    const normalizedLabel = label.toLowerCase().trim();
    if (detectedSet.has(normalizedLabel)) {
      found.push(label);
    } else {
      missing.push(label);
    }
  }

  return { found, missing };
}


/**
 * Compares expected items against vision-detected objects to produce a checklist result.
 * 
 * This function works with VisionDetectedObject which uses normalized bounding boxes.
 * An item is considered "found" if it appears in both expected and detected sets
 * with confidence above the threshold.
 * 
 * Requirements: 1.2, 4.3
 * 
 * @param expectedItems - Array of expected items with labels and required flags
 * @param visionObjects - Array of vision-detected objects with labels and confidence scores
 * @param confidenceThreshold - Minimum confidence required to consider an item detected (default 0.5)
 * @returns ChecklistResult with found/missing items and pass/fail status
 */
export function compareVisionChecklist(
  expectedItems: ExpectedItem[],
  visionObjects: VisionDetectedObject[],
  confidenceThreshold: number = 0.5
): ChecklistResult {
  // Build a map of detected labels to their highest confidence score
  const detectedMap = new Map<string, number>();
  for (const obj of visionObjects) {
    const normalizedLabel = obj.label.toLowerCase().trim();
    const existingConfidence = detectedMap.get(normalizedLabel) ?? 0;
    if (obj.confidence > existingConfidence) {
      detectedMap.set(normalizedLabel, obj.confidence);
    }
  }

  const items: ChecklistItemResult[] = [];
  const found: string[] = [];
  const missing: string[] = [];
  let allRequiredFound = true;

  for (const expected of expectedItems) {
    const normalizedLabel = expected.label.toLowerCase().trim();
    const detectedConfidence = detectedMap.get(normalizedLabel);
    
    // Use item-specific min_confidence if set, otherwise use the threshold
    const effectiveThreshold = expected.min_confidence ?? confidenceThreshold;
    
    // Item is found if it exists in detected set AND meets confidence threshold
    const itemFound = detectedConfidence !== undefined && detectedConfidence >= effectiveThreshold;
    
    items.push({
      label: expected.label,
      required: expected.required,
      found: itemFound,
      confidence: detectedConfidence ?? null
    });

    if (itemFound) {
      found.push(expected.label);
    } else {
      missing.push(expected.label);
      // If a required item is missing, the overall check fails
      if (expected.required) {
        allRequiredFound = false;
      }
    }
  }

  return {
    items,
    found,
    missing,
    pass: allRequiredFound
  };
}

/**
 * Maps vision detection labels to expected item labels using fuzzy matching.
 * 
 * This helps match detected objects like "salad_greens" to expected items like "lettuce".
 * Uses a simple contains-based matching strategy.
 * 
 * Requirements: 1.2
 * 
 * @param visionLabel - The label from vision detection
 * @param expectedLabels - Array of expected item labels to match against
 * @returns The matched expected label, or the original vision label if no match
 */
export function mapVisionLabelToExpected(
  visionLabel: string,
  expectedLabels: string[]
): string {
  const normalizedVision = visionLabel.toLowerCase().trim();
  
  // First try exact match
  for (const expected of expectedLabels) {
    if (expected.toLowerCase().trim() === normalizedVision) {
      return expected;
    }
  }
  
  // Then try contains match (vision label contains expected or vice versa)
  for (const expected of expectedLabels) {
    const normalizedExpected = expected.toLowerCase().trim();
    if (normalizedVision.includes(normalizedExpected) || normalizedExpected.includes(normalizedVision)) {
      return expected;
    }
  }
  
  // No match found, return original
  return visionLabel;
}

/**
 * Transforms vision detection objects by mapping their labels to expected items.
 * 
 * Requirements: 1.2
 * 
 * @param visionObjects - Array of vision-detected objects
 * @param expectedLabels - Array of expected item labels to map to
 * @returns Array of vision objects with mapped labels
 */
export function mapVisionObjectsToExpected(
  visionObjects: VisionDetectedObject[],
  expectedLabels: string[]
): VisionDetectedObject[] {
  return visionObjects.map(obj => ({
    ...obj,
    label: mapVisionLabelToExpected(obj.label, expectedLabels)
  }));
}
