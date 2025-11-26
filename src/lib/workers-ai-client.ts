/**
 * HeySalad QC - Workers AI Client for Object Detection
 * 
 * Provides integration with Cloudflare Workers AI for object detection.
 * Uses @cf/facebook/detr-resnet-50 model for detection with bounding boxes.
 * 
 * Requirements: 1.2, 3.4
 */

import type { VisionDetectedObject, VisionBoundingBox } from '../types';

// =============================================================================
// Workers AI Response Types
// =============================================================================

/**
 * Raw bounding box from Workers AI DETR model
 * Coordinates are in pixel values relative to input image dimensions
 */
export interface WorkersAIBoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

/**
 * Raw detection result from Workers AI DETR model
 */
export interface WorkersAIDetection {
  label: string;
  score: number;
  box: WorkersAIBoundingBox;
}

/**
 * Raw response from Workers AI object detection model
 */
export type WorkersAIDetectionResponse = WorkersAIDetection[];

// =============================================================================
// Constants
// =============================================================================

/** Default confidence threshold for filtering detections */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

/** Workers AI model identifier for object detection */
export const DETECTION_MODEL = '@cf/facebook/detr-resnet-50';

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Runs object detection on an image using Workers AI
 * 
 * @param ai - Workers AI binding from environment
 * @param imageData - Raw image bytes (JPEG or PNG)
 * @returns Raw detection results from Workers AI
 * @throws Error if AI binding is not available or detection fails
 * 
 * Requirements: 1.2
 */
export async function runDetection(
  ai: Ai,
  imageData: ArrayBuffer | Uint8Array
): Promise<WorkersAIDetectionResponse> {
  const input = imageData instanceof ArrayBuffer 
    ? new Uint8Array(imageData) 
    : imageData;
  
  // Use type assertion since the model string is a valid Workers AI model
  // but may not be in the type definitions yet
  const response = await ai.run(DETECTION_MODEL as Parameters<typeof ai.run>[0], {
    image: [...input]
  });
  
  // Workers AI returns array of detections directly
  if (!Array.isArray(response)) {
    throw new Error('Unexpected response format from Workers AI');
  }
  
  return response as WorkersAIDetectionResponse;
}

/**
 * Filters detection results by confidence threshold
 * Only includes detections with confidence strictly greater than threshold
 * 
 * @param detections - Raw detections from Workers AI
 * @param threshold - Minimum confidence score (exclusive), defaults to 0.5
 * @returns Filtered detections with confidence > threshold
 * 
 * Requirements: 1.2
 * **Property 1: Confidence threshold filtering**
 */
export function filterByConfidence(
  detections: WorkersAIDetection[],
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): WorkersAIDetection[] {
  return detections.filter(detection => detection.score > threshold);
}

/**
 * Normalizes a bounding box from pixel coordinates to 0-1 range
 * 
 * @param box - Bounding box in pixel coordinates (xmin, ymin, xmax, ymax)
 * @param imageWidth - Width of the source image in pixels
 * @param imageHeight - Height of the source image in pixels
 * @returns Normalized bounding box with values in 0-1 range
 */
export function normalizeBoundingBox(
  box: WorkersAIBoundingBox,
  imageWidth: number,
  imageHeight: number
): VisionBoundingBox {
  const x = Math.max(0, Math.min(1, box.xmin / imageWidth));
  const y = Math.max(0, Math.min(1, box.ymin / imageHeight));
  const width = Math.max(0, Math.min(1, (box.xmax - box.xmin) / imageWidth));
  const height = Math.max(0, Math.min(1, (box.ymax - box.ymin) / imageHeight));
  
  return { x, y, width, height };
}

/**
 * Transforms a single Workers AI detection to HeySalad schema
 * 
 * @param detection - Raw detection from Workers AI
 * @param imageWidth - Width of the source image in pixels
 * @param imageHeight - Height of the source image in pixels
 * @returns Detection in HeySalad VisionDetectedObject format
 * 
 * Requirements: 3.4
 */
export function transformDetection(
  detection: WorkersAIDetection,
  imageWidth: number,
  imageHeight: number
): VisionDetectedObject {
  return {
    label: detection.label,
    confidence: detection.score,
    bbox: normalizeBoundingBox(detection.box, imageWidth, imageHeight)
  };
}

/**
 * Transforms Workers AI detection response to HeySalad schema
 * Applies confidence filtering and normalizes bounding boxes
 * 
 * @param detections - Raw detections from Workers AI
 * @param imageWidth - Width of the source image in pixels
 * @param imageHeight - Height of the source image in pixels
 * @param confidenceThreshold - Minimum confidence score (exclusive), defaults to 0.5
 * @returns Array of detections in HeySalad VisionDetectedObject format
 * 
 * Requirements: 1.2, 3.4
 * **Property 9: Detection result schema transformation**
 */
export function transformDetectionResults(
  detections: WorkersAIDetectionResponse,
  imageWidth: number,
  imageHeight: number,
  confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): VisionDetectedObject[] {
  const filtered = filterByConfidence(detections, confidenceThreshold);
  return filtered.map(detection => transformDetection(detection, imageWidth, imageHeight));
}

/**
 * High-level function to run detection and transform results
 * Combines runDetection, filtering, and transformation
 * 
 * @param ai - Workers AI binding from environment
 * @param imageData - Raw image bytes (JPEG or PNG)
 * @param imageWidth - Width of the source image in pixels
 * @param imageHeight - Height of the source image in pixels
 * @param confidenceThreshold - Minimum confidence score (exclusive), defaults to 0.5
 * @returns Array of detections in HeySalad VisionDetectedObject format
 * 
 * Requirements: 1.2, 3.4
 */
export async function detectObjects(
  ai: Ai,
  imageData: ArrayBuffer | Uint8Array,
  imageWidth: number,
  imageHeight: number,
  confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): Promise<VisionDetectedObject[]> {
  const rawDetections = await runDetection(ai, imageData);
  return transformDetectionResults(rawDetections, imageWidth, imageHeight, confidenceThreshold);
}
