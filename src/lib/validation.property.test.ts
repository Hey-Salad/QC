/**
 * HeySalad QC - Property-Based Tests for Validation
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  isValidConfidenceThreshold, 
  validateConfidenceThreshold,
  validateCreateStationInput,
  validateDetectionRulesInput
} from './validation';

const fcConfig = { numRuns: 100 };

describe('Validation Property Tests', () => {
  /**
   * **Feature: heysalad-qc, Property 6: Confidence Threshold Validation**
   * 
   * *For any* confidence threshold value, the system should accept values 
   * in the range [0.0, 1.0] inclusive and reject values outside this range.
   * 
   * **Validates: Requirements 4.2**
   */
  describe('Property 6: Confidence Threshold Validation', () => {
    test('accepts any number in range [0.0, 1.0]', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.0, max: 1.0, noNaN: true }),
          (threshold) => {
            expect(isValidConfidenceThreshold(threshold)).toBe(true);
            const result = validateConfidenceThreshold(threshold);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        fcConfig
      );
    });

    test('rejects any number less than 0.0', () => {
      fc.assert(
        fc.property(
          fc.double({ max: -Number.MIN_VALUE, noNaN: true }),
          (threshold) => {
            expect(isValidConfidenceThreshold(threshold)).toBe(false);
            const result = validateConfidenceThreshold(threshold);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        fcConfig
      );
    });

    test('rejects any number greater than 1.0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1.0000001, noNaN: true }),
          (threshold) => {
            expect(isValidConfidenceThreshold(threshold)).toBe(false);
            const result = validateConfidenceThreshold(threshold);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        fcConfig
      );
    });

    test('rejects non-number types', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.boolean(),
            fc.object(),
            fc.array(fc.anything())
          ),
          (value) => {
            expect(isValidConfidenceThreshold(value)).toBe(false);
            const result = validateConfidenceThreshold(value);
            expect(result.valid).toBe(false);
          }
        ),
        fcConfig
      );
    });

    test('rejects NaN', () => {
      expect(isValidConfidenceThreshold(NaN)).toBe(false);
      const result = validateConfidenceThreshold(NaN);
      expect(result.valid).toBe(false);
    });

    test('accepts boundary values 0.0 and 1.0', () => {
      expect(isValidConfidenceThreshold(0.0)).toBe(true);
      expect(isValidConfidenceThreshold(1.0)).toBe(true);
      expect(validateConfidenceThreshold(0.0).valid).toBe(true);
      expect(validateConfidenceThreshold(1.0).valid).toBe(true);
    });
  });

  /**
   * **Feature: heysalad-qc, Property 9: API Request Validation**
   * 
   * *For any* API request body with missing required fields or invalid JSON,
   * the system should reject the request with an appropriate error response
   * rather than processing it.
   * 
   * **Validates: Requirements 8.3**
   */
  describe('Property 9: API Request Validation', () => {
    test('rejects station input with missing required name field', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('packing', 'prep', 'storage', 'receiving'),
            location: fc.option(fc.string(), { nil: undefined }),
            description: fc.option(fc.string(), { nil: undefined })
          }),
          (input) => {
            // Input without name should be rejected
            const result = validateCreateStationInput(input);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.toLowerCase().includes('name'))).toBe(true);
          }
        ),
        fcConfig
      );
    });

    test('rejects station input with missing required type field', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            location: fc.option(fc.string(), { nil: undefined }),
            description: fc.option(fc.string(), { nil: undefined })
          }),
          (input) => {
            // Input without type should be rejected
            const result = validateCreateStationInput(input);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.toLowerCase().includes('type'))).toBe(true);
          }
        ),
        fcConfig
      );
    });

    test('rejects station input with invalid type value', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            type: fc.string().filter(s => !['packing', 'prep', 'storage', 'receiving'].includes(s)),
            location: fc.option(fc.string(), { nil: undefined }),
            description: fc.option(fc.string(), { nil: undefined })
          }),
          (input) => {
            const result = validateCreateStationInput(input);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.toLowerCase().includes('type'))).toBe(true);
          }
        ),
        fcConfig
      );
    });

    test('rejects detection rules input with missing expected_items', () => {
      fc.assert(
        fc.property(
          fc.record({
            confidence_threshold: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined })
          }),
          (input) => {
            const result = validateDetectionRulesInput(input);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.toLowerCase().includes('expected'))).toBe(true);
          }
        ),
        fcConfig
      );
    });

    test('rejects non-object inputs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (input) => {
            const stationResult = validateCreateStationInput(input);
            expect(stationResult.valid).toBe(false);
            
            const rulesResult = validateDetectionRulesInput(input);
            expect(rulesResult.valid).toBe(false);
          }
        ),
        fcConfig
      );
    });

    test('accepts valid station input with all required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            // Name must have non-whitespace content (validation trims and checks length >= 1)
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1),
            type: fc.constantFrom('packing', 'prep', 'storage', 'receiving'),
            location: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
            description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
          }),
          (input) => {
            const result = validateCreateStationInput(input);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        fcConfig
      );
    });
  });
});
