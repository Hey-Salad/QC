/**
 * HeySalad QC - Property-Based Tests for Serialization
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  serializeStation,
  deserializeStation,
  serializeDetectionRules,
  deserializeDetectionRules,
  serializeDetectionResult,
  deserializeDetectionResult
} from './serialization';
import type {
  Station,
  DetectionRules,
  DetectionResult,
  StationType,
  AlertTrigger
} from '../types';

const fcConfig = { numRuns: 100 };

// =============================================================================
// Arbitraries (Generators)
// =============================================================================

const stationTypeArb: fc.Arbitrary<StationType> = fc.constantFrom(
  'packing', 'prep', 'storage', 'receiving'
);

const alertTriggerArb: fc.Arbitrary<AlertTrigger> = fc.constantFrom(
  'missing_item', 'low_confidence', 'all_failures'
);

const uuidArb = fc.uuid();

// Generate valid ISO date strings directly to avoid invalid date issues
const isoDateArb = fc.integer({ min: 946684800000, max: 1924905600000 })
  .map(ts => new Date(ts).toISOString());

const stationArb: fc.Arbitrary<Station> = fc.record({
  id: uuidArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  type: stationTypeArb,
  location: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  qr_code_url: fc.option(fc.webUrl(), { nil: null }),
  created_at: isoDateArb,
  updated_at: isoDateArb
});


const expectedItemArb = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }),
  required: fc.boolean(),
  min_confidence: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined })
});

const alertConfigArb = fc.record({
  enabled: fc.boolean(),
  email: fc.option(fc.emailAddress(), { nil: undefined }),
  slack_webhook: fc.option(fc.webUrl(), { nil: undefined }),
  sms: fc.option(fc.string({ minLength: 10, maxLength: 15 }), { nil: undefined }),
  triggers: fc.array(alertTriggerArb, { maxLength: 3 })
});

const detectionRulesArb: fc.Arbitrary<DetectionRules> = fc.record({
  id: uuidArb,
  station_id: uuidArb,
  expected_items: fc.array(expectedItemArb, { maxLength: 10 }),
  confidence_threshold: fc.double({ min: 0, max: 1, noNaN: true }),
  alert_config: alertConfigArb,
  created_at: isoDateArb
});

const boundingBoxArb = fc.tuple(
  fc.integer({ min: 0, max: 1000 }),
  fc.integer({ min: 0, max: 1000 }),
  fc.integer({ min: 1, max: 500 }),
  fc.integer({ min: 1, max: 500 })
) as fc.Arbitrary<[number, number, number, number]>;

const detectedObjectArb = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  bbox: boundingBoxArb
});

const detectionResultArb: fc.Arbitrary<DetectionResult> = fc.record({
  detected_objects: fc.array(detectedObjectArb, { maxLength: 10 }),
  expected_objects: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
  timestamp: isoDateArb,
  pass: fc.boolean(),
  missing: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
});

// =============================================================================
// Property Tests
// =============================================================================

describe('Serialization Property Tests', () => {
  /**
   * **Feature: heysalad-qc, Property 8: Data Model Serialization Round-Trip**
   * 
   * *For any* valid Station, DetectionRules, or DetectionResult object,
   * serializing to JSON and then deserializing should produce an object
   * equivalent to the original.
   * 
   * **Validates: Requirements 8.5**
   */
  describe('Property 8: Data Model Serialization Round-Trip', () => {
    test('Station round-trip produces equivalent object', () => {
      fc.assert(
        fc.property(stationArb, (station) => {
          const serialized = serializeStation(station);
          const deserialized = deserializeStation(serialized);
          
          expect(deserialized.id).toBe(station.id);
          expect(deserialized.name).toBe(station.name);
          expect(deserialized.type).toBe(station.type);
          expect(deserialized.location).toBe(station.location);
          expect(deserialized.description).toBe(station.description);
          expect(deserialized.qr_code_url).toBe(station.qr_code_url);
          expect(deserialized.created_at).toBe(station.created_at);
          expect(deserialized.updated_at).toBe(station.updated_at);
        }),
        fcConfig
      );
    });

    test('DetectionRules round-trip produces equivalent object', () => {
      fc.assert(
        fc.property(detectionRulesArb, (rules) => {
          const serialized = serializeDetectionRules(rules);
          const deserialized = deserializeDetectionRules(serialized);
          
          expect(deserialized.id).toBe(rules.id);
          expect(deserialized.station_id).toBe(rules.station_id);
          expect(deserialized.confidence_threshold).toBe(rules.confidence_threshold);
          expect(deserialized.created_at).toBe(rules.created_at);
          expect(deserialized.expected_items).toEqual(rules.expected_items);
          expect(deserialized.alert_config.enabled).toBe(rules.alert_config.enabled);
          expect(deserialized.alert_config.triggers).toEqual(rules.alert_config.triggers);
        }),
        fcConfig
      );
    });

    test('DetectionResult round-trip produces equivalent object', () => {
      fc.assert(
        fc.property(detectionResultArb, (result) => {
          const serialized = serializeDetectionResult(result);
          const deserialized = deserializeDetectionResult(serialized);
          
          expect(deserialized.timestamp).toBe(result.timestamp);
          expect(deserialized.pass).toBe(result.pass);
          expect(deserialized.expected_objects).toEqual(result.expected_objects);
          expect(deserialized.missing).toEqual(result.missing);
          expect(deserialized.detected_objects.length).toBe(result.detected_objects.length);
          
          for (let i = 0; i < result.detected_objects.length; i++) {
            expect(deserialized.detected_objects[i].label).toBe(result.detected_objects[i].label);
            expect(deserialized.detected_objects[i].confidence).toBe(result.detected_objects[i].confidence);
            expect(deserialized.detected_objects[i].bbox).toEqual(result.detected_objects[i].bbox);
          }
        }),
        fcConfig
      );
    });
  });
});
