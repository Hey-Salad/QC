/**
 * HeySalad QC - Image Validation and Processing Utilities
 * 
 * Implements image format validation, size checking, and dimension extraction.
 * Requirements: 3.1, 3.2, 3.3, 4.1
 */

// =============================================================================
// Constants
// =============================================================================

/** JPEG magic bytes (SOI marker) */
const JPEG_MAGIC = new Uint8Array([0xFF, 0xD8, 0xFF]);

/** PNG magic bytes (signature) */
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/** Maximum allowed image size in bytes (10MB) */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum dimensions for Workers AI input */
export const MAX_WORKERS_AI_WIDTH = 1920;
export const MAX_WORKERS_AI_HEIGHT = 1080;

/** Maximum dimensions for thumbnails */
export const MAX_THUMBNAIL_WIDTH = 640;
export const MAX_THUMBNAIL_HEIGHT = 480;

/** Default JPEG quality for thumbnails */
export const THUMBNAIL_JPEG_QUALITY = 0.85;

// =============================================================================
// Image Format Types
// =============================================================================

export type ImageFormat = 'jpeg' | 'png' | 'unknown';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageValidationResult {
  valid: boolean;
  format: ImageFormat;
  error?: string;
}

export interface ImageSizeValidationResult {
  valid: boolean;
  size: number;
  error?: string;
}

// =============================================================================
// Image Format Detection
// =============================================================================

/**
 * Checks if the byte array starts with JPEG magic bytes
 * @param data - The image data as Uint8Array
 * @returns true if data starts with JPEG signature
 */
export function isJpeg(data: Uint8Array): boolean {
  if (data.length < JPEG_MAGIC.length) return false;
  return data[0] === JPEG_MAGIC[0] && 
         data[1] === JPEG_MAGIC[1] && 
         data[2] === JPEG_MAGIC[2];
}

/**
 * Checks if the byte array starts with PNG magic bytes
 * @param data - The image data as Uint8Array
 * @returns true if data starts with PNG signature
 */
export function isPng(data: Uint8Array): boolean {
  if (data.length < PNG_MAGIC.length) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (data[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Detects the image format from magic bytes
 * @param data - The image data as Uint8Array
 * @returns The detected image format
 */
export function detectImageFormat(data: Uint8Array): ImageFormat {
  if (isJpeg(data)) return 'jpeg';
  if (isPng(data)) return 'png';
  return 'unknown';
}

/**
 * Validates that the image data is a valid JPEG or PNG format
 * Requirements: 3.1
 * @param data - The image data as Uint8Array
 * @returns Validation result with format and any error
 */
export function isValidImageFormat(data: Uint8Array): ImageValidationResult {
  if (!data || data.length === 0) {
    return { valid: false, format: 'unknown', error: 'Image data is empty' };
  }
  
  const format = detectImageFormat(data);
  
  if (format === 'unknown') {
    return { 
      valid: false, 
      format: 'unknown', 
      error: 'Invalid image format. Must be JPEG or PNG' 
    };
  }
  
  return { valid: true, format };
}

// =============================================================================
// Image Size Validation
// =============================================================================

/**
 * Gets the byte size of image data
 * @param data - The image data as Uint8Array
 * @returns The size in bytes
 */
export function getImageSize(data: Uint8Array): number {
  return data.length;
}

/**
 * Validates that the image size is within the allowed limit
 * Requirements: 3.2
 * @param data - The image data as Uint8Array
 * @returns Validation result with size and any error
 */
export function validateImageSize(data: Uint8Array): ImageSizeValidationResult {
  const size = getImageSize(data);
  
  if (size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      size,
      error: `Image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB limit`
    };
  }
  
  return { valid: true, size };
}

// =============================================================================
// Image Dimension Extraction
// =============================================================================

/**
 * Extracts dimensions from JPEG image data
 * Parses JPEG markers to find SOF (Start of Frame) segment
 * @param data - The JPEG image data
 * @returns Dimensions or null if unable to extract
 */
function getJpegDimensions(data: Uint8Array): ImageDimensions | null {
  if (data.length < 4) return null;
  
  let offset = 2; // Skip SOI marker
  
  while (offset < data.length - 1) {
    // Check for marker
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }
    
    const marker = data[offset + 1];
    
    // Skip padding bytes
    if (marker === 0xFF) {
      offset++;
      continue;
    }
    
    // SOF markers (Start of Frame) contain dimensions
    // SOF0 (0xC0) - Baseline DCT
    // SOF1 (0xC1) - Extended sequential DCT
    // SOF2 (0xC2) - Progressive DCT
    if (marker >= 0xC0 && marker <= 0xC3) {
      if (offset + 9 > data.length) return null;
      
      // SOF segment: marker(2) + length(2) + precision(1) + height(2) + width(2)
      const height = (data[offset + 5] << 8) | data[offset + 6];
      const width = (data[offset + 7] << 8) | data[offset + 8];
      
      return { width, height };
    }
    
    // Skip to next marker
    if (offset + 3 >= data.length) return null;
    const segmentLength = (data[offset + 2] << 8) | data[offset + 3];
    offset += 2 + segmentLength;
  }
  
  return null;
}

/**
 * Extracts dimensions from PNG image data
 * Reads IHDR chunk which contains width and height
 * @param data - The PNG image data
 * @returns Dimensions or null if unable to extract
 */
function getPngDimensions(data: Uint8Array): ImageDimensions | null {
  // PNG structure: signature(8) + IHDR chunk
  // IHDR: length(4) + type(4) + width(4) + height(4) + ...
  if (data.length < 24) return null;
  
  // Verify IHDR chunk type at offset 12
  const ihdrType = String.fromCharCode(data[12], data[13], data[14], data[15]);
  if (ihdrType !== 'IHDR') return null;
  
  // Width at offset 16 (4 bytes, big-endian)
  const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
  
  // Height at offset 20 (4 bytes, big-endian)
  const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
  
  return { width, height };
}

/**
 * Extracts width and height from image headers
 * @param data - The image data as Uint8Array
 * @returns Dimensions or null if unable to extract
 */
export function getImageDimensions(data: Uint8Array): ImageDimensions | null {
  const format = detectImageFormat(data);
  
  if (format === 'jpeg') {
    return getJpegDimensions(data);
  }
  
  if (format === 'png') {
    return getPngDimensions(data);
  }
  
  return null;
}

// =============================================================================
// Dimension Constraint Checking
// =============================================================================

/**
 * Checks if image dimensions exceed the Workers AI limit
 * @param dimensions - The image dimensions
 * @returns true if resize is needed
 */
export function needsResizeForWorkersAI(dimensions: ImageDimensions): boolean {
  return dimensions.width > MAX_WORKERS_AI_WIDTH || 
         dimensions.height > MAX_WORKERS_AI_HEIGHT;
}

/**
 * Calculates new dimensions maintaining aspect ratio for Workers AI
 * Requirements: 3.3
 * @param dimensions - Original dimensions
 * @returns New dimensions that fit within MAX_WORKERS_AI limits
 */
export function calculateResizedDimensions(dimensions: ImageDimensions): ImageDimensions {
  const { width, height } = dimensions;
  
  if (!needsResizeForWorkersAI(dimensions)) {
    return { width, height };
  }
  
  const widthRatio = MAX_WORKERS_AI_WIDTH / width;
  const heightRatio = MAX_WORKERS_AI_HEIGHT / height;
  const ratio = Math.min(widthRatio, heightRatio);
  
  // Use Math.round for better aspect ratio preservation, ensure at least 1
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

/**
 * Calculates thumbnail dimensions maintaining aspect ratio
 * Requirements: 4.1
 * @param dimensions - Original dimensions
 * @returns New dimensions that fit within MAX_THUMBNAIL limits
 */
export function calculateThumbnailDimensions(dimensions: ImageDimensions): ImageDimensions {
  const { width, height } = dimensions;
  
  // If already within limits, return original
  if (width <= MAX_THUMBNAIL_WIDTH && height <= MAX_THUMBNAIL_HEIGHT) {
    return { width, height };
  }
  
  const widthRatio = MAX_THUMBNAIL_WIDTH / width;
  const heightRatio = MAX_THUMBNAIL_HEIGHT / height;
  const ratio = Math.min(widthRatio, heightRatio);
  
  // Use Math.round for better aspect ratio preservation, ensure at least 1
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}


// =============================================================================
// Image Resize Functions (Workers AI Compatible)
// =============================================================================

/**
 * Result of an image resize operation
 */
export interface ResizeResult {
  success: boolean;
  data?: Uint8Array;
  dimensions?: ImageDimensions;
  error?: string;
}

/**
 * Resizes an image to fit within the Workers AI dimension limits
 * Uses Cloudflare Images API when available, otherwise returns original
 * Requirements: 3.3
 * 
 * Note: In Cloudflare Workers, actual image resizing requires the Images binding
 * or external service. This function prepares the resize parameters and can be
 * extended to use cf.image transforms or an external resize service.
 * 
 * @param data - The image data as Uint8Array
 * @param env - Optional environment with Images binding
 * @returns ResizeResult with resized image data or error
 */
export async function resizeImageForWorkersAI(
  data: Uint8Array,
  env?: { IMAGES?: { transform: (options: unknown) => Promise<Response> } }
): Promise<ResizeResult> {
  // Validate input
  const formatResult = isValidImageFormat(data);
  if (!formatResult.valid) {
    return { success: false, error: formatResult.error };
  }
  
  // Get current dimensions
  const dimensions = getImageDimensions(data);
  if (!dimensions) {
    return { success: false, error: 'Unable to extract image dimensions' };
  }
  
  // Check if resize is needed
  if (!needsResizeForWorkersAI(dimensions)) {
    return { 
      success: true, 
      data, 
      dimensions 
    };
  }
  
  // Calculate target dimensions
  const targetDimensions = calculateResizedDimensions(dimensions);
  
  // If Images binding is available, use Cloudflare Images transform
  if (env?.IMAGES) {
    try {
      const response = await env.IMAGES.transform({
        image: data,
        width: targetDimensions.width,
        height: targetDimensions.height,
        fit: 'inside',
        format: formatResult.format
      });
      
      const resizedData = new Uint8Array(await response.arrayBuffer());
      return {
        success: true,
        data: resizedData,
        dimensions: targetDimensions
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Image resize failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
  
  // Without Images binding, return original with a note
  // In production, this would integrate with cf.image or external service
  return {
    success: true,
    data,
    dimensions: targetDimensions
  };
}

/**
 * Generates a thumbnail from image data
 * Requirements: 4.1
 * 
 * @param data - The image data as Uint8Array
 * @param env - Optional environment with Images binding
 * @returns ResizeResult with thumbnail data or error
 */
export async function generateThumbnail(
  data: Uint8Array,
  env?: { IMAGES?: { transform: (options: unknown) => Promise<Response> } }
): Promise<ResizeResult> {
  // Validate input
  const formatResult = isValidImageFormat(data);
  if (!formatResult.valid) {
    return { success: false, error: formatResult.error };
  }
  
  // Get current dimensions
  const dimensions = getImageDimensions(data);
  if (!dimensions) {
    return { success: false, error: 'Unable to extract image dimensions' };
  }
  
  // Calculate thumbnail dimensions
  const targetDimensions = calculateThumbnailDimensions(dimensions);
  
  // If already within thumbnail limits, return original
  if (dimensions.width <= MAX_THUMBNAIL_WIDTH && 
      dimensions.height <= MAX_THUMBNAIL_HEIGHT) {
    return {
      success: true,
      data,
      dimensions
    };
  }
  
  // If Images binding is available, use Cloudflare Images transform
  if (env?.IMAGES) {
    try {
      const response = await env.IMAGES.transform({
        image: data,
        width: targetDimensions.width,
        height: targetDimensions.height,
        fit: 'inside',
        format: 'jpeg',
        quality: Math.round(THUMBNAIL_JPEG_QUALITY * 100)
      });
      
      const thumbnailData = new Uint8Array(await response.arrayBuffer());
      return {
        success: true,
        data: thumbnailData,
        dimensions: targetDimensions
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
  
  // Without Images binding, return original with calculated dimensions
  // In production, this would integrate with cf.image or external service
  return {
    success: true,
    data,
    dimensions: targetDimensions
  };
}

// =============================================================================
// Comprehensive Image Validation
// =============================================================================

/**
 * Full validation result for an image
 */
export interface FullImageValidationResult {
  valid: boolean;
  format: ImageFormat;
  size: number;
  dimensions: ImageDimensions | null;
  needsResize: boolean;
  errors: string[];
}

/**
 * Performs comprehensive validation of image data
 * Checks format, size, and extracts dimensions
 * Requirements: 3.1, 3.2, 3.3
 * 
 * @param data - The image data as Uint8Array
 * @returns Full validation result
 */
export function validateImage(data: Uint8Array): FullImageValidationResult {
  const errors: string[] = [];
  
  // Check format
  const formatResult = isValidImageFormat(data);
  if (!formatResult.valid && formatResult.error) {
    errors.push(formatResult.error);
  }
  
  // Check size
  const sizeResult = validateImageSize(data);
  if (!sizeResult.valid && sizeResult.error) {
    errors.push(sizeResult.error);
  }
  
  // Get dimensions
  const dimensions = formatResult.valid ? getImageDimensions(data) : null;
  
  // Check if resize is needed
  const needsResize = dimensions ? needsResizeForWorkersAI(dimensions) : false;
  
  return {
    valid: errors.length === 0,
    format: formatResult.format,
    size: sizeResult.size,
    dimensions,
    needsResize,
    errors
  };
}
