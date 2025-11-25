/**
 * HeySalad QC - Mock Detection Processor
 * 
 * Generates mock detection results for testing.
 * Returns DetectionResult with detected_objects, pass/fail status.
 * Requirements: 3.6
 */

import type { DetectionResult, DetectedObject, ExpectedItem, BoundingBox } from '../types';
import { compareChecklist } from './checklist';

const MOCK_DETECTABLE_ITEMS = [
  'lettuce', 'tomato', 'cucumber', 'onion', 'carrot', 'chicken',
  'beef', 'tofu', 'cheese', 'dressing', 'croutons', 'bacon',
  'egg', 'avocado', 'pepper', 'salt', 'napkin', 'fork',
  'knife', 'container', 'lid', 'label'
];

function generateRandomBbox(): BoundingBox {
  const x = Math.floor(Math.random() * 500);
  const y = Math.floor(Math.random() * 400);
  const width = Math.floor(Math.random() * 100) + 50;
  const height = Math.floor(Math.random() * 100) + 50;
  return [x, y, width, height];
}

function generateRandomConfidence(): number {
  return 0.5 + Math.random() * 0.5;
}

export function generateMockDetectedObjects(
  expectedItems: ExpectedItem[],
  detectionRate: number = 0.8
): DetectedObject[] {
  const detected: DetectedObject[] = [];
  for (const item of expectedItems) {
    if (Math.random() < detectionRate) {
      detected.push({
        label: item.label,
        confidence: generateRandomConfidence(),
        bbox: generateRandomBbox()
      });
    }
  }
  if (Math.random() < 0.3) {
    const randomItem = MOCK_DETECTABLE_ITEMS[Math.floor(Math.random() * MOCK_DETECTABLE_ITEMS.length)];
    const alreadyDetected = detected.some(d => d.label.toLowerCase() === randomItem.toLowerCase());
    if (!alreadyDetected) {
      detected.push({
        label: randomItem,
        confidence: generateRandomConfidence(),
        bbox: generateRandomBbox()
      });
    }
  }
  return detected;
}

export function processMockDetection(
  expectedItems: ExpectedItem[],
  confidenceThreshold: number = 0.75,
  detectionRate: number = 0.8
): DetectionResult {
  const detectedObjects = generateMockDetectedObjects(expectedItems, detectionRate);
  const checklistResult = compareChecklist(expectedItems, detectedObjects, confidenceThreshold);
  return {
    detected_objects: detectedObjects,
    expected_objects: expectedItems.map(item => item.label),
    timestamp: new Date().toISOString(),
    pass: checklistResult.pass,
    missing: checklistResult.missing
  };
}

export function processDeterministicDetection(
  expectedItems: ExpectedItem[]
): DetectionResult {
  const detectedObjects: DetectedObject[] = expectedItems.map((item, index) => ({
    label: item.label,
    confidence: 0.95,
    bbox: [index * 100, index * 80, 80, 60] as BoundingBox
  }));
  return {
    detected_objects: detectedObjects,
    expected_objects: expectedItems.map(item => item.label),
    timestamp: new Date().toISOString(),
    pass: true,
    missing: []
  };
}

export function processFailingDetection(
  expectedItems: ExpectedItem[]
): DetectionResult {
  const hasRequiredItems = expectedItems.some(item => item.required);
  return {
    detected_objects: [],
    expected_objects: expectedItems.map(item => item.label),
    timestamp: new Date().toISOString(),
    pass: !hasRequiredItems,
    missing: expectedItems.map(item => item.label)
  };
}
