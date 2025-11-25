/**
 * HeySalad QC - Property-Based Tests for QR Code Generation
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  generateStationUrl, 
  extractStationIdFromUrl,
  QC_BASE_URL 
} from './qrcode';

const fcConfig = { numRuns: 100 };

/**
 * UUID v4 arbitrary generator for testing
 */
const uuidArbitrary = fc.uuid();

describe('QR Code Property Tests', () => {
  /**
   * **Feature: heysalad-qc, Property 4: QR Code URL Format Correctness**
   * 
   * *For any* station with a valid UUID, the generated QR code should decode 
   * to exactly `https://qc.heysalad.app/station/{station_id}` where 
   * `{station_id}` matches the station's ID.
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 4: QR Code URL Format Correctness', () => {
    test('generated URL follows exact format https://qc.heysalad.app/station/{station_id}', () => {
      fc.assert(
        fc.property(
          uuidArbitrary,
          (stationId) => {
            const url = generateStationUrl(stationId);
            
            // URL must start with the base URL
            expect(url.startsWith(QC_BASE_URL)).toBe(true);
            
            // URL must be exactly base URL + "/" + station ID
            expect(url).toBe(`${QC_BASE_URL}/${stationId}`);
            
            // URL must match the exact expected format
            const expectedFormat = `https://qc.heysalad.app/station/${stationId}`;
            expect(url).toBe(expectedFormat);
          }
        ),
        fcConfig
      );
    });

    test('station ID can be extracted from generated URL (round-trip)', () => {
      fc.assert(
        fc.property(
          uuidArbitrary,
          (stationId) => {
            const url = generateStationUrl(stationId);
            const extractedId = extractStationIdFromUrl(url);
            
            // Round-trip: generate URL then extract ID should return original ID
            expect(extractedId).toBe(stationId);
          }
        ),
        fcConfig
      );
    });

    test('URL contains no extra path segments or query parameters', () => {
      fc.assert(
        fc.property(
          uuidArbitrary,
          (stationId) => {
            const url = generateStationUrl(stationId);
            
            // Count path segments after base URL
            const pathAfterBase = url.slice(QC_BASE_URL.length);
            const segments = pathAfterBase.split('/').filter(s => s.length > 0);
            
            // Should have exactly one segment (the station ID)
            expect(segments).toHaveLength(1);
            expect(segments[0]).toBe(stationId);
            
            // Should not contain query string or hash
            expect(url.includes('?')).toBe(false);
            expect(url.includes('#')).toBe(false);
          }
        ),
        fcConfig
      );
    });

    test('rejects URLs with incorrect base URL', () => {
      fc.assert(
        fc.property(
          uuidArbitrary,
          fc.string({ minLength: 1 }).filter(s => !s.includes('qc.heysalad.app')),
          (stationId, wrongDomain) => {
            const wrongUrl = `https://${wrongDomain}/station/${stationId}`;
            const extractedId = extractStationIdFromUrl(wrongUrl);
            
            // Should return null for URLs with wrong base
            expect(extractedId).toBeNull();
          }
        ),
        fcConfig
      );
    });

    test('rejects URLs with extra path segments', () => {
      fc.assert(
        fc.property(
          uuidArbitrary,
          fc.string({ minLength: 1 }).filter(s => !s.includes('/') && !s.includes('?') && !s.includes('#')),
          (stationId, extraSegment) => {
            const urlWithExtra = `${QC_BASE_URL}/${stationId}/${extraSegment}`;
            const extractedId = extractStationIdFromUrl(urlWithExtra);
            
            // Should return null for URLs with extra path segments
            expect(extractedId).toBeNull();
          }
        ),
        fcConfig
      );
    });

    test('rejects URLs with query parameters', () => {
      fc.assert(
        fc.property(
          uuidArbitrary,
          fc.string({ minLength: 1 }),
          (stationId, queryValue) => {
            const urlWithQuery = `${QC_BASE_URL}/${stationId}?param=${queryValue}`;
            const extractedId = extractStationIdFromUrl(urlWithQuery);
            
            // Should return null for URLs with query parameters
            expect(extractedId).toBeNull();
          }
        ),
        fcConfig
      );
    });
  });
});
