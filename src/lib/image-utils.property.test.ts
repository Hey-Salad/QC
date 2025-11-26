/**
 * HeySalad QC - Property-Based Tests for Image Utilities
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 * 
 * Tests Properties 6, 7, 8, 11 from the design document.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidImageFormat,
  validateImageSize,
  getImageSize,
  getImageDimensions,
  calculateResizedDimensions,
  calculateThumbnailDimensions,
  needsResizeForWorkersAI,
  MAX_IMAGE_SIZE_BYTES,
  MAX_WORKERS_AI_WIDTH,
  MAX_WORKERS_AI_HEIGHT,
  MAX_THUMBNAIL_WIDTH,
  MAX_THUMBNAIL_HEIGHT,
  type ImageDimensions
} from './image-utils';

const fcConfig = { numRuns: 100 };

// =============================================================================
// Test Data Generators (Arbitraries)
// =============================================================================

/**
 * Creates a minimal valid JPEG with specified dimensions
 * This creates a valid JPEG structure with SOF0 marker containing dimensions
 */
function createMinimalJpeg(width: number, height: number): Uint8Array {
  // Clamp dimensions to valid JPEG range (1-65535)
  const w = Math.max(1, Math.min(65535, Math.floor(width)));
  const h = Math.max(1, Math.min(65535, Math.floor(height)));
  
  // Minimal JPEG structure:
  // SOI (0xFFD8) + APP0 marker + SOF0 marker with dimensions + EOI (0xFFD9)
  const jpeg = new Uint8Array([
    // SOI marker
    0xFF, 0xD8,
    // APP0 marker (JFIF)
    0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    // SOF0 marker (Start of Frame - Baseline DCT)
    0xFF, 0xC0, 0x00, 0x0B, 0x08,
    (h >> 8) & 0xFF, h & 0xFF,  // Height (2 bytes, big-endian)
    (w >> 8) & 0xFF, w & 0xFF,  // Width (2 bytes, big-endian)
    0x01, 0x01, 0x11, 0x00,     // Components
    // EOI marker
    0xFF, 0xD9
  ]);
  
  return jpeg;
}

/**
 * Creates a minimal valid PNG with specified dimensions
 * This creates a valid PNG structure with IHDR chunk containing dimensions
 */
function createMinimalPng(width: number, height: number): Uint8Array {
  // Clamp dimensions to valid PNG range
  const w = Math.max(1, Math.min(2147483647, Math.floor(width)));
  const h = Math.max(1, Math.min(2147483647, Math.floor(height)));
  
  // Minimal PNG structure:
  // Signature + IHDR chunk + IEND chunk
  const png = new Uint8Array([
    // PNG signature
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    // IHDR chunk
    0x00, 0x00, 0x00, 0x0D,  // Length: 13 bytes
    0x49, 0x48, 0x44, 0x52,  // Type: IHDR
    (w >> 24) & 0xFF, (w >> 16) & 0xFF, (w >> 8) & 0xFF, w & 0xFF,  // Width (4 bytes)
    (h >> 24) & 0xFF, (h >> 16) & 0xFF, (h >> 8) & 0xFF, h & 0xFF,  // Height (4 bytes)
    0x08, 0x02, 0x00, 0x00, 0x00,  // Bit depth, color type, compression, filter, interlace
    0x00, 0x00, 0x00, 0x00,  // CRC (placeholder)
    // IEND chunk
    0x00, 0x00, 0x00, 0x00,  // Length: 0
    0x49, 0x45, 0x4E, 0x44,  // Type: IEND
    0xAE, 0x42, 0x60, 0x82   // CRC
  ]);
  
  return png;
}

/** Arbitrary for valid JPEG image data with random dimensions */
const validJpegArb = fc.record({
  width: fc.integer({ min: 1, max: 4000 }),
  height: fc.integer({ min: 1, max: 4000 })
}).map(({ width, height }) => createMinimalJpeg(width, height));

/** Arbitrary for valid PNG image data with random dimensions */
const validPngArb = fc.record({
  width: fc.integer({ min: 1, max: 4000 }),
  height: fc.integer({ min: 1, max: 4000 })
}).map(({ width, height }) => createMinimalPng(width, height));

/** Arbitrary for invalid image data (random bytes that don't start with magic bytes) */
const invalidImageArb = fc.uint8Array({ minLength: 1, maxLength: 100 })
  .filter(data => {
    // Ensure it doesn't accidentally start with JPEG or PNG magic bytes
    if (data.length >= 3 && data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return false;
    }
    if (data.length >= 8 && 
        data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 &&
        data[4] === 0x0D && data[5] === 0x0A && data[6] === 0x1A && data[7] === 0x0A) {
      return false;
    }
    return true;
  });

/** Arbitrary for image dimensions */
const dimensionsArb: fc.Arbitrary<ImageDimensions> = fc.record({
  width: fc.integer({ min: 1, max: 10000 }),
  height: fc.integer({ min: 1, max: 10000 })
});

/** Arbitrary for dimensions that exceed Workers AI limits (realistic image sizes) */
const oversizedDimensionsArb: fc.Arbitrary<ImageDimensions> = fc.oneof(
  // Width exceeds limit (realistic height >= 100)
  fc.record({
    width: fc.integer({ min: MAX_WORKERS_AI_WIDTH + 1, max: 10000 }),
    height: fc.integer({ min: 100, max: MAX_WORKERS_AI_HEIGHT })
  }),
  // Height exceeds limit (realistic width >= 100)
  fc.record({
    width: fc.integer({ min: 100, max: MAX_WORKERS_AI_WIDTH }),
    height: fc.integer({ min: MAX_WORKERS_AI_HEIGHT + 1, max: 10000 })
  }),
  // Both exceed limits
  fc.record({
    width: fc.integer({ min: MAX_WORKERS_AI_WIDTH + 1, max: 10000 }),
    height: fc.integer({ min: MAX_WORKERS_AI_HEIGHT + 1, max: 10000 })
  })
);

// =============================================================================
// Property Tests
// =============================================================================

describe('Image Utils Property Tests', () => {
  /**
   * **Feature: cloud-vision-integration, Property 6: Image format validation**
   * 
   * *For any* byte array submitted as a frame, the API SHALL accept it if and only if
   * it is a valid JPEG or PNG image.
   * 
   * **Validates: Requirements 3.1**
   */
  describe('Property 6: Image format validation', () => {
    test('valid JPEG images are accepted', () => {
      fc.assert(
        fc.property(validJpegArb, (jpegData) => {
          const result = isValidImageFormat(jpegData);
          expect(result.valid).toBe(true);
          expect(result.format).toBe('jpeg');
          expect(result.error).toBeUndefined();
        }),
        fcConfig
      );
    });

    test('valid PNG images are accepted', () => {
      fc.assert(
        fc.property(validPngArb, (pngData) => {
          const result = isValidImageFormat(pngData);
          expect(result.valid).toBe(true);
          expect(result.format).toBe('png');
          expect(result.error).toBeUndefined();
        }),
        fcConfig
      );
    });

    test('invalid image data is rejected', () => {
      fc.assert(
        fc.property(invalidImageArb, (invalidData) => {
          const result = isValidImageFormat(invalidData);
          expect(result.valid).toBe(false);
          expect(result.format).toBe('unknown');
          expect(result.error).toBeDefined();
        }),
        fcConfig
      );
    });

    test('empty data is rejected', () => {
      const result = isValidImageFormat(new Uint8Array(0));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Image data is empty');
    });
  });

  /**
   * **Feature: cloud-vision-integration, Property 7: Image size validation**
   * 
   * *For any* image submitted as a frame, if the image size exceeds 10MB,
   * the API SHALL reject it with an error.
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 7: Image size validation', () => {
    test('images within size limit are accepted', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: MAX_IMAGE_SIZE_BYTES }),
          (size) => {
            const data = new Uint8Array(size);
            const result = validateImageSize(data);
            expect(result.valid).toBe(true);
            expect(result.size).toBe(size);
            expect(result.error).toBeUndefined();
          }
        ),
        { ...fcConfig, numRuns: 20 } // Reduced runs due to memory allocation
      );
    });

    test('images exceeding size limit are rejected', () => {
      // Test with sizes just over the limit (to avoid memory issues)
      fc.assert(
        fc.property(
          fc.integer({ min: MAX_IMAGE_SIZE_BYTES + 1, max: MAX_IMAGE_SIZE_BYTES + 1000 }),
          (size) => {
            const data = new Uint8Array(size);
            const result = validateImageSize(data);
            expect(result.valid).toBe(false);
            expect(result.size).toBe(size);
            expect(result.error).toContain('10MB limit');
          }
        ),
        { ...fcConfig, numRuns: 10 } // Reduced runs due to memory allocation
      );
    });

    test('getImageSize returns correct byte count', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 0, maxLength: 10000 }),
          (data) => {
            const size = getImageSize(data);
            expect(size).toBe(data.length);
          }
        ),
        fcConfig
      );
    });
  });

  /**
   * **Feature: cloud-vision-integration, Property 8: Image resize constraint**
   * 
   * *For any* image larger than 1920x1080 pixels, after resizing, the output dimensions
   * SHALL be at most 1920x1080 while maintaining aspect ratio.
   * 
   * **Validates: Requirements 3.3**
   */
  describe('Property 8: Image resize constraint', () => {
    test('oversized images are resized to fit within limits', () => {
      fc.assert(
        fc.property(oversizedDimensionsArb, (dimensions) => {
          const resized = calculateResizedDimensions(dimensions);
          
          // Output must be within limits
          expect(resized.width).toBeLessThanOrEqual(MAX_WORKERS_AI_WIDTH);
          expect(resized.height).toBeLessThanOrEqual(MAX_WORKERS_AI_HEIGHT);
          
          // Dimensions must be positive
          expect(resized.width).toBeGreaterThan(0);
          expect(resized.height).toBeGreaterThan(0);
        }),
        fcConfig
      );
    });

    test('aspect ratio is maintained after resize', () => {
      fc.assert(
        fc.property(oversizedDimensionsArb, (dimensions) => {
          const resized = calculateResizedDimensions(dimensions);
          
          const originalRatio = dimensions.width / dimensions.height;
          const resizedRatio = resized.width / resized.height;
          
          // Allow tolerance due to integer rounding (larger for extreme ratios)
          // Relative error is more appropriate for varying aspect ratios
          const relativeError = Math.abs(originalRatio - resizedRatio) / originalRatio;
          expect(relativeError).toBeLessThan(0.05);
        }),
        fcConfig
      );
    });

    test('images within limits are not resized', () => {
      fc.assert(
        fc.property(
          fc.record({
            width: fc.integer({ min: 1, max: MAX_WORKERS_AI_WIDTH }),
            height: fc.integer({ min: 1, max: MAX_WORKERS_AI_HEIGHT })
          }),
          (dimensions) => {
            const resized = calculateResizedDimensions(dimensions);
            expect(resized.width).toBe(dimensions.width);
            expect(resized.height).toBe(dimensions.height);
          }
        ),
        fcConfig
      );
    });

    test('needsResizeForWorkersAI correctly identifies oversized images', () => {
      fc.assert(
        fc.property(dimensionsArb, (dimensions) => {
          const needsResize = needsResizeForWorkersAI(dimensions);
          const exceedsLimits = dimensions.width > MAX_WORKERS_AI_WIDTH || 
                               dimensions.height > MAX_WORKERS_AI_HEIGHT;
          expect(needsResize).toBe(exceedsLimits);
        }),
        fcConfig
      );
    });
  });

  /**
   * **Feature: cloud-vision-integration, Property 11: Thumbnail size constraint**
   * 
   * *For any* frame processed for thumbnail storage, the resulting thumbnail dimensions
   * SHALL be at most 640x480 pixels.
   * 
   * **Validates: Requirements 4.1**
   */
  describe('Property 11: Thumbnail size constraint', () => {
    test('thumbnail dimensions are always within limits', () => {
      fc.assert(
        fc.property(dimensionsArb, (dimensions) => {
          const thumbnail = calculateThumbnailDimensions(dimensions);
          
          expect(thumbnail.width).toBeLessThanOrEqual(MAX_THUMBNAIL_WIDTH);
          expect(thumbnail.height).toBeLessThanOrEqual(MAX_THUMBNAIL_HEIGHT);
          expect(thumbnail.width).toBeGreaterThan(0);
          expect(thumbnail.height).toBeGreaterThan(0);
        }),
        fcConfig
      );
    });

    test('thumbnail aspect ratio is maintained', () => {
      fc.assert(
        fc.property(
          fc.record({
            width: fc.integer({ min: MAX_THUMBNAIL_WIDTH + 1, max: 10000 }),
            height: fc.integer({ min: MAX_THUMBNAIL_HEIGHT + 1, max: 10000 })
          }),
          (dimensions) => {
            const thumbnail = calculateThumbnailDimensions(dimensions);
            
            const originalRatio = dimensions.width / dimensions.height;
            const thumbnailRatio = thumbnail.width / thumbnail.height;
            
            // Allow tolerance due to integer rounding (larger for extreme ratios)
            // Relative error is more appropriate for varying aspect ratios
            const relativeError = Math.abs(originalRatio - thumbnailRatio) / originalRatio;
            expect(relativeError).toBeLessThan(0.05);
          }
        ),
        fcConfig
      );
    });

    test('small images are not resized for thumbnails', () => {
      fc.assert(
        fc.property(
          fc.record({
            width: fc.integer({ min: 1, max: MAX_THUMBNAIL_WIDTH }),
            height: fc.integer({ min: 1, max: MAX_THUMBNAIL_HEIGHT })
          }),
          (dimensions) => {
            const thumbnail = calculateThumbnailDimensions(dimensions);
            expect(thumbnail.width).toBe(dimensions.width);
            expect(thumbnail.height).toBe(dimensions.height);
          }
        ),
        fcConfig
      );
    });
  });

  /**
   * Additional tests for dimension extraction
   */
  describe('Image dimension extraction', () => {
    test('JPEG dimensions are correctly extracted', () => {
      fc.assert(
        fc.property(
          fc.record({
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 })
          }),
          ({ width, height }) => {
            const jpeg = createMinimalJpeg(width, height);
            const dimensions = getImageDimensions(jpeg);
            
            expect(dimensions).not.toBeNull();
            expect(dimensions!.width).toBe(width);
            expect(dimensions!.height).toBe(height);
          }
        ),
        fcConfig
      );
    });

    test('PNG dimensions are correctly extracted', () => {
      fc.assert(
        fc.property(
          fc.record({
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 })
          }),
          ({ width, height }) => {
            const png = createMinimalPng(width, height);
            const dimensions = getImageDimensions(png);
            
            expect(dimensions).not.toBeNull();
            expect(dimensions!.width).toBe(width);
            expect(dimensions!.height).toBe(height);
          }
        ),
        fcConfig
      );
    });
  });
});
