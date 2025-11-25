/**
 * HeySalad QC - Property-Based Tests for Checklist Comparison
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { compareChecklist, compareLabels } from './checklist';
import type { BoundingBox } from '../types';

const fcConfig = { numRuns: 100 };

// Arbitrary for generating expected items
const expectedItemArb = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  required: fc.boolean(),
  min_confidence: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined })
});

// Arbitrary for generating detected objects
const detectedObjectArb = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  bbox: fc.tuple(
    fc.integer({ min: 0, max: 1000 }),
    fc.integer({ min: 0, max: 1000 }),
    fc.integer({ min: 1, max: 500 }),
    fc.integer({ min: 1, max: 500 })
  ) as fc.Arbitrary<BoundingBox>
});

describe('Checklist Property Tests', () => {
  /**
   * **Feature: heysalad-qc, Property 5: Detection Checklist Correctness**
   * 
   * *For any* set of expected items and detected items, the checklist should mark
   * an item as "found" if and only if it appears in both sets, and mark an item
   * as "missing" if and only if it appears in expected but not in detected.
   * 
   * **Validates: Requirements 3.4, 4.3**
   */
  describe('Property 5: Detection Checklist Correctness', () => {
    test('item is found if and only if it appears in both expected and detected sets', () => {
      fc.assert(
        fc.property(
          fc.array(expectedItemArb, { minLength: 0, maxLength: 10 }),
          fc.array(detectedObjectArb, { minLength: 0, maxLength: 10 }),
          (expectedItems, detectedObjects) => {
            const result = compareChecklist(expectedItems, detectedObjects, 0);
            
            // Build set of detected labels (normalized)
            const detectedLabels = new Set(
              detectedObjects.map(d => d.label.toLowerCase().trim())
            );
            
            // For each expected item, verify found status is correct
            for (const item of result.items) {
              const normalizedLabel = item.label.toLowerCase().trim();
              const shouldBeFound = detectedLabels.has(normalizedLabel);
              expect(item.found).toBe(shouldBeFound);
            }
          }
        ),
        fcConfig
      );
    });

    test('item is missing if and only if it appears in expected but not in detected', () => {
      fc.assert(
        fc.property(
          fc.array(expectedItemArb, { minLength: 0, maxLength: 10 }),
          fc.array(detectedObjectArb, { minLength: 0, maxLength: 10 }),
          (expectedItems, detectedObjects) => {
            const result = compareChecklist(expectedItems, detectedObjects, 0);
            
            // Build set of detected labels (normalized)
            const detectedLabels = new Set(
              detectedObjects.map(d => d.label.toLowerCase().trim())
            );
            
            // Verify missing array contains exactly the items not in detected
            for (const label of result.missing) {
              const normalizedLabel = label.toLowerCase().trim();
              expect(detectedLabels.has(normalizedLabel)).toBe(false);
            }
            
            // Verify found array contains exactly the items in detected
            for (const label of result.found) {
              const normalizedLabel = label.toLowerCase().trim();
              expect(detectedLabels.has(normalizedLabel)).toBe(true);
            }
          }
        ),
        fcConfig
      );
    });

    test('pass is false if any required item is missing', () => {
      fc.assert(
        fc.property(
          fc.array(expectedItemArb, { minLength: 1, maxLength: 10 }),
          fc.array(detectedObjectArb, { minLength: 0, maxLength: 10 }),
          (expectedItems, detectedObjects) => {
            const result = compareChecklist(expectedItems, detectedObjects, 0);
            
            // Build set of detected labels (normalized)
            const detectedLabels = new Set(
              detectedObjects.map(d => d.label.toLowerCase().trim())
            );
            
            // Check if any required item is missing
            const hasRequiredMissing = expectedItems.some(item => {
              const normalizedLabel = item.label.toLowerCase().trim();
              return item.required && !detectedLabels.has(normalizedLabel);
            });
            
            if (hasRequiredMissing) {
              expect(result.pass).toBe(false);
            }
          }
        ),
        fcConfig
      );
    });

    test('pass is true if all required items are found', () => {
      fc.assert(
        fc.property(
          fc.array(expectedItemArb, { minLength: 0, maxLength: 10 }),
          fc.array(detectedObjectArb, { minLength: 0, maxLength: 10 }),
          (expectedItems, detectedObjects) => {
            const result = compareChecklist(expectedItems, detectedObjects, 0);
            
            // Build set of detected labels (normalized)
            const detectedLabels = new Set(
              detectedObjects.map(d => d.label.toLowerCase().trim())
            );
            
            // Check if all required items are found
            const allRequiredFound = expectedItems.every(item => {
              const normalizedLabel = item.label.toLowerCase().trim();
              return !item.required || detectedLabels.has(normalizedLabel);
            });
            
            if (allRequiredFound) {
              expect(result.pass).toBe(true);
            }
          }
        ),
        fcConfig
      );
    });

    test('found and missing arrays partition expected items', () => {
      fc.assert(
        fc.property(
          fc.array(expectedItemArb, { minLength: 0, maxLength: 10 }),
          fc.array(detectedObjectArb, { minLength: 0, maxLength: 10 }),
          (expectedItems, detectedObjects) => {
            const result = compareChecklist(expectedItems, detectedObjects, 0);
            
            // Every expected item should be in exactly one of found or missing
            expect(result.found.length + result.missing.length).toBe(expectedItems.length);
            
            // No overlap between found and missing
            const foundSet = new Set(result.found);
            for (const label of result.missing) {
              expect(foundSet.has(label)).toBe(false);
            }
          }
        ),
        fcConfig
      );
    });

    test('confidence threshold filters detected items correctly', () => {
      fc.assert(
        fc.property(
          fc.array(expectedItemArb, { minLength: 1, maxLength: 5 }),
          fc.array(detectedObjectArb, { minLength: 1, maxLength: 5 }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          (expectedItems, detectedObjects, threshold) => {
            const result = compareChecklist(expectedItems, detectedObjects, threshold);
            
            // Build map of detected labels to max confidence
            const detectedMap = new Map<string, number>();
            for (const obj of detectedObjects) {
              const normalizedLabel = obj.label.toLowerCase().trim();
              const existing = detectedMap.get(normalizedLabel) ?? 0;
              if (obj.confidence > existing) {
                detectedMap.set(normalizedLabel, obj.confidence);
              }
            }
            
            // Verify each item's found status respects threshold
            for (const item of result.items) {
              const normalizedLabel = item.label.toLowerCase().trim();
              const confidence = detectedMap.get(normalizedLabel);
              
              if (confidence !== undefined && confidence >= threshold) {
                expect(item.found).toBe(true);
              } else {
                expect(item.found).toBe(false);
              }
            }
          }
        ),
        fcConfig
      );
    });
  });

  describe('compareLabels function', () => {
    test('found contains only labels present in both sets', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 0, maxLength: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 0, maxLength: 10 }),
          (expected, detected) => {
            const result = compareLabels(expected, detected);
            
            const detectedSet = new Set(detected.map(l => l.toLowerCase().trim()));
            
            for (const label of result.found) {
              expect(detectedSet.has(label.toLowerCase().trim())).toBe(true);
            }
          }
        ),
        fcConfig
      );
    });

    test('missing contains only labels in expected but not detected', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 0, maxLength: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 0, maxLength: 10 }),
          (expected, detected) => {
            const result = compareLabels(expected, detected);
            
            const detectedSet = new Set(detected.map(l => l.toLowerCase().trim()));
            
            for (const label of result.missing) {
              expect(detectedSet.has(label.toLowerCase().trim())).toBe(false);
            }
          }
        ),
        fcConfig
      );
    });
  });
});
