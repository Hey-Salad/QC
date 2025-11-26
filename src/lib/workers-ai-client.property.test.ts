/**
 * HeySalad QC - Property-Based Tests for Workers AI Client
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 * 
 * **Feature: cloud-vision-integration, Property 1: Confidence threshold filtering**
 * **Feature: cloud-vision-integration, Property 9: Detection result schema transformation**
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  filterByConfidence,
  transformDetection,
  transformDetectionResults,
  normalizeBoundingBox,
  DEFAULT_CONFIDENCE_THRESHOLD,
  type WorkersAIDetection,
  type WorkersAIBoundingBox
} from './workers-ai-client';
// VisionDetectedObject type is used implicitly through transformDetection return type

const fcConfig = { numRuns: 100 };

// =============================================================================
// Arbitraries (Generators)
// =============================================================================

/**
 * Generator for Workers AI bounding box
 * Uses pixel coordinates (can be any positive number)
 */
const workersAIBoundingBoxArb: fc.Arbitrary<WorkersAIBoundingBox> = fc.record({
  xmin: fc.double({ min: 0, max: 1920, noNaN: true }),
  ymin: fc.double({ min: 0, max: 1080, noNaN: true }),
  xmax: fc.double({ min: 0, max: 1920, noNaN: true }),
  ymax: fc.double({ min: 0, max: 1080, noNaN: true })
}).filter(box => box.xmax >= box.xmin && box.ymax >= box.ymin);

/**
 * Generator for Workers AI detection result
 */
const workersAIDetectionArb: fc.Arbitrary<WorkersAIDetection> = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }),
  score: fc.double({ min: 0, max: 1, noNaN: true }),
  box: workersAIBoundingBoxArb
});

/**
 * Generator for array of Workers AI detections
 */
const workersAIDetectionsArb = fc.array(workersAIDetectionArb, { maxLength: 50 });

/**
 * Generator for confidence threshold (0-1 range)
 */
const thresholdArb = fc.double({ min: 0, max: 1, noNaN: true });

/**
 * Generator for image dimensions (positive integers)
 */
const imageDimensionsArb = fc.record({
  width: fc.integer({ min: 1, max: 4096 }),
  height: fc.integer({ min: 1, max: 4096 })
});

// =============================================================================
// Property Tests
// =============================================================================

describe('Workers AI Client Property Tests', () => {
  /**
   * **Feature: cloud-vision-integration, Property 1: Confidence threshold filtering**
   * 
   * *For any* set of detection results from Workers AI, the filtered output
   * SHALL only contain objects with confidence scores strictly greater than 0.5.
   * 
   * **Validates: Requirements 1.2**
   */
  describe('Property 1: Confidence threshold filtering', () => {
    test('filtered results only contain detections with confidence > threshold', () => {
      fc.assert(
        fc.property(workersAIDetectionsArb, thresholdArb, (detections, threshold) => {
          const filtered = filterByConfidence(detections, threshold);
          
          // All filtered results must have confidence > threshold
          for (const detection of filtered) {
            expect(detection.score).toBeGreaterThan(threshold);
          }
        }),
        fcConfig
      );
    });

    test('filtered results with default threshold only contain confidence > 0.5', () => {
      fc.assert(
        fc.property(workersAIDetectionsArb, (detections) => {
          const filtered = filterByConfidence(detections);
          
          // All filtered results must have confidence > DEFAULT_CONFIDENCE_THRESHOLD (0.5)
          for (const detection of filtered) {
            expect(detection.score).toBeGreaterThan(DEFAULT_CONFIDENCE_THRESHOLD);
          }
        }),
        fcConfig
      );
    });

    test('no detections with confidence <= threshold are included', () => {
      fc.assert(
        fc.property(workersAIDetectionsArb, thresholdArb, (detections, threshold) => {
          const filtered = filterByConfidence(detections, threshold);
          const filteredLabels = new Set(filtered.map(d => `${d.label}-${d.score}`));
          
          // Check that no detection with score <= threshold made it through
          for (const detection of detections) {
            if (detection.score <= threshold) {
              // This detection should NOT be in filtered results
              // (using label+score as unique identifier)
              const key = `${detection.label}-${detection.score}`;
              // If it's in filtered, it must be a different detection with same label but higher score
              if (filteredLabels.has(key)) {
                // This would be a bug - same detection shouldn't be included
                expect(detection.score).toBeGreaterThan(threshold);
              }
            }
          }
        }),
        fcConfig
      );
    });

    test('filtering preserves all detections above threshold', () => {
      fc.assert(
        fc.property(workersAIDetectionsArb, thresholdArb, (detections, threshold) => {
          const filtered = filterByConfidence(detections, threshold);
          const expectedCount = detections.filter(d => d.score > threshold).length;
          
          expect(filtered.length).toBe(expectedCount);
        }),
        fcConfig
      );
    });
  });

  /**
   * **Feature: cloud-vision-integration, Property 9: Detection result schema transformation**
   * 
   * *For any* raw Workers AI detection response, the transformed output
   * SHALL conform to the HeySalad DetectedObject schema with label, confidence, and bbox fields.
   * 
   * **Validates: Requirements 3.4**
   */
  describe('Property 9: Detection result schema transformation', () => {
    test('transformed detection has required schema fields', () => {
      fc.assert(
        fc.property(workersAIDetectionArb, imageDimensionsArb, (detection, dims) => {
          const transformed = transformDetection(detection, dims.width, dims.height);
          
          // Verify schema conformance
          expect(typeof transformed.label).toBe('string');
          expect(typeof transformed.confidence).toBe('number');
          expect(typeof transformed.bbox).toBe('object');
          expect(typeof transformed.bbox.x).toBe('number');
          expect(typeof transformed.bbox.y).toBe('number');
          expect(typeof transformed.bbox.width).toBe('number');
          expect(typeof transformed.bbox.height).toBe('number');
        }),
        fcConfig
      );
    });

    test('transformed detection preserves label and confidence', () => {
      fc.assert(
        fc.property(workersAIDetectionArb, imageDimensionsArb, (detection, dims) => {
          const transformed = transformDetection(detection, dims.width, dims.height);
          
          expect(transformed.label).toBe(detection.label);
          expect(transformed.confidence).toBe(detection.score);
        }),
        fcConfig
      );
    });

    test('normalized bounding box values are in 0-1 range', () => {
      fc.assert(
        fc.property(workersAIDetectionArb, imageDimensionsArb, (detection, dims) => {
          const transformed = transformDetection(detection, dims.width, dims.height);
          
          expect(transformed.bbox.x).toBeGreaterThanOrEqual(0);
          expect(transformed.bbox.x).toBeLessThanOrEqual(1);
          expect(transformed.bbox.y).toBeGreaterThanOrEqual(0);
          expect(transformed.bbox.y).toBeLessThanOrEqual(1);
          expect(transformed.bbox.width).toBeGreaterThanOrEqual(0);
          expect(transformed.bbox.width).toBeLessThanOrEqual(1);
          expect(transformed.bbox.height).toBeGreaterThanOrEqual(0);
          expect(transformed.bbox.height).toBeLessThanOrEqual(1);
        }),
        fcConfig
      );
    });

    test('transformDetectionResults applies both filtering and transformation', () => {
      fc.assert(
        fc.property(workersAIDetectionsArb, imageDimensionsArb, thresholdArb, (detections, dims, threshold) => {
          const transformed = transformDetectionResults(detections, dims.width, dims.height, threshold);
          
          // Count should match filtered count
          const expectedCount = detections.filter(d => d.score > threshold).length;
          expect(transformed.length).toBe(expectedCount);
          
          // All results should have valid schema
          for (const obj of transformed) {
            expect(typeof obj.label).toBe('string');
            expect(typeof obj.confidence).toBe('number');
            expect(obj.confidence).toBeGreaterThan(threshold);
            expect(obj.bbox.x).toBeGreaterThanOrEqual(0);
            expect(obj.bbox.x).toBeLessThanOrEqual(1);
            expect(obj.bbox.y).toBeGreaterThanOrEqual(0);
            expect(obj.bbox.y).toBeLessThanOrEqual(1);
            expect(obj.bbox.width).toBeGreaterThanOrEqual(0);
            expect(obj.bbox.width).toBeLessThanOrEqual(1);
            expect(obj.bbox.height).toBeGreaterThanOrEqual(0);
            expect(obj.bbox.height).toBeLessThanOrEqual(1);
          }
        }),
        fcConfig
      );
    });

    test('normalizeBoundingBox correctly normalizes pixel coordinates', () => {
      fc.assert(
        fc.property(workersAIBoundingBoxArb, imageDimensionsArb, (box, dims) => {
          const normalized = normalizeBoundingBox(box, dims.width, dims.height);
          
          // Values should be clamped to 0-1 range
          expect(normalized.x).toBeGreaterThanOrEqual(0);
          expect(normalized.x).toBeLessThanOrEqual(1);
          expect(normalized.y).toBeGreaterThanOrEqual(0);
          expect(normalized.y).toBeLessThanOrEqual(1);
          expect(normalized.width).toBeGreaterThanOrEqual(0);
          expect(normalized.width).toBeLessThanOrEqual(1);
          expect(normalized.height).toBeGreaterThanOrEqual(0);
          expect(normalized.height).toBeLessThanOrEqual(1);
        }),
        fcConfig
      );
    });
  });
});
