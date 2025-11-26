/**
 * HeySalad QC - Property-Based Tests for Vision Serialization
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 * 
 * **Feature: cloud-vision-integration, Property 10: Detection result round-trip serialization**
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  serializeVisionDetection,
  deserializeVisionDetection,
  serializeCameraMapping,
  deserializeCameraMapping,
  serializeCameraHealth,
  deserializeCameraHealth
} from './vision-serialization';
import type {
  VisionDetection,
  VisionDetectedObject,
  VisionBoundingBox,
  CameraMapping,
  CameraHealth,
  CameraStatus
} from '../types';

const fcConfig = { numRuns: 100 };

// =============================================================================
// Arbitraries (Generators)
// =============================================================================

const uuidArb = fc.uuid();

// Generate valid ISO date strings
const isoDateArb = fc.integer({ min: 946684800000, max: 1924905600000 })
  .map(ts => new Date(ts).toISOString());

// Vision bounding box with normalized 0-1 coordinates
const visionBoundingBoxArb: fc.Arbitrary<VisionBoundingBox> = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
  width: fc.double({ min: 0, max: 1, noNaN: true }),
  height: fc.double({ min: 0, max: 1, noNaN: true })
});

// Vision detected object
const visionDetectedObjectArb: fc.Arbitrary<VisionDetectedObject> = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  bbox: visionBoundingBoxArb
});

// Vision detection result
const visionDetectionArb: fc.Arbitrary<VisionDetection> = fc.record({
  id: uuidArb,
  camera_id: fc.string({ minLength: 1, maxLength: 50 }),
  station_id: uuidArb,
  timestamp: isoDateArb,
  objects: fc.array(visionDetectedObjectArb, { maxLength: 20 }),
  thumbnail_key: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  processing_time_ms: fc.integer({ min: 0, max: 60000 })
});

// Camera mapping
const cameraMappingArb: fc.Arbitrary<CameraMapping> = fc.record({
  camera_id: fc.string({ minLength: 1, maxLength: 50 }),
  station_id: uuidArb,
  rtsp_url: fc.string({ minLength: 1, maxLength: 200 }).map(s => `rtsp://${s}`),
  name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  created_at: isoDateArb,
  updated_at: isoDateArb
});

// Camera status
const cameraStatusArb: fc.Arbitrary<CameraStatus> = fc.constantFrom(
  'online', 'offline', 'error', 'unknown'
);

// Camera health
const cameraHealthArb: fc.Arbitrary<CameraHealth> = fc.record({
  camera_id: fc.string({ minLength: 1, maxLength: 50 }),
  last_frame_at: fc.option(isoDateArb, { nil: null }),
  error_count: fc.integer({ min: 0, max: 10000 }),
  last_error: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  status: cameraStatusArb
});

// =============================================================================
// Property Tests
// =============================================================================

describe('Vision Serialization Property Tests', () => {
  /**
   * **Feature: cloud-vision-integration, Property 10: Detection result round-trip serialization**
   * 
   * *For any* valid VisionDetection object, serializing to JSON and deserializing back
   * SHALL produce an equivalent object.
   * 
   * **Validates: Requirements 3.5, 3.6**
   */
  describe('Property 10: Detection result round-trip serialization', () => {
    test('VisionDetection round-trip produces equivalent object', () => {
      fc.assert(
        fc.property(visionDetectionArb, (detection) => {
          const serialized = serializeVisionDetection(detection);
          const deserialized = deserializeVisionDetection(serialized);
          
          // Verify all fields match
          expect(deserialized.id).toBe(detection.id);
          expect(deserialized.camera_id).toBe(detection.camera_id);
          expect(deserialized.station_id).toBe(detection.station_id);
          expect(deserialized.timestamp).toBe(detection.timestamp);
          expect(deserialized.thumbnail_key).toBe(detection.thumbnail_key);
          expect(deserialized.processing_time_ms).toBe(detection.processing_time_ms);
          
          // Verify objects array
          expect(deserialized.objects.length).toBe(detection.objects.length);
          for (let i = 0; i < detection.objects.length; i++) {
            const original = detection.objects[i];
            const restored = deserialized.objects[i];
            
            expect(restored.label).toBe(original.label);
            expect(restored.confidence).toBe(original.confidence);
            expect(restored.bbox.x).toBe(original.bbox.x);
            expect(restored.bbox.y).toBe(original.bbox.y);
            expect(restored.bbox.width).toBe(original.bbox.width);
            expect(restored.bbox.height).toBe(original.bbox.height);
          }
        }),
        fcConfig
      );
    });

    test('CameraMapping round-trip produces equivalent object', () => {
      fc.assert(
        fc.property(cameraMappingArb, (mapping) => {
          const serialized = serializeCameraMapping(mapping);
          const deserialized = deserializeCameraMapping(serialized);
          
          expect(deserialized.camera_id).toBe(mapping.camera_id);
          expect(deserialized.station_id).toBe(mapping.station_id);
          expect(deserialized.rtsp_url).toBe(mapping.rtsp_url);
          expect(deserialized.name).toBe(mapping.name);
          expect(deserialized.created_at).toBe(mapping.created_at);
          expect(deserialized.updated_at).toBe(mapping.updated_at);
        }),
        fcConfig
      );
    });

    test('CameraHealth round-trip produces equivalent object', () => {
      fc.assert(
        fc.property(cameraHealthArb, (health) => {
          const serialized = serializeCameraHealth(health);
          const deserialized = deserializeCameraHealth(serialized);
          
          expect(deserialized.camera_id).toBe(health.camera_id);
          expect(deserialized.last_frame_at).toBe(health.last_frame_at);
          expect(deserialized.error_count).toBe(health.error_count);
          expect(deserialized.last_error).toBe(health.last_error);
          expect(deserialized.status).toBe(health.status);
        }),
        fcConfig
      );
    });
  });
});
