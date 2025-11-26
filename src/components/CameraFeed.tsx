/**
 * HeySalad QC - CameraFeed Component
 * 
 * Displays camera feed with detection overlay support.
 * Supports both real thumbnails from vision API and placeholder mode.
 * Displays bounding boxes, confidence scores, and object labels.
 * Responsive design that scales on mobile devices.
 * Requirements: 3.2, 3.3, 4.3, 6.2
 */

import { useState } from 'react';
import type { DetectedObject, VisionDetectedObject } from '../types';

/** Bounding box in normalized coordinates (0-1) */
interface NormalizedBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraFeedProps {
  /** Base width for aspect ratio calculation (default: 640) */
  width?: number;
  /** Base height for aspect ratio calculation (default: 480) */
  height?: number;
  /** Legacy detections with pixel-based bounding boxes */
  detections?: DetectedObject[];
  /** Vision detections with normalized bounding boxes (0-1) */
  visionDetections?: VisionDetectedObject[];
  /** Whether to show detection overlays (default: true) */
  showOverlay?: boolean;
  /** Whether the component is in processing state */
  isProcessing?: boolean;
  /** URL of the thumbnail image to display */
  thumbnailUrl?: string | null;
  /** Alt text for the thumbnail image */
  thumbnailAlt?: string;
  /** Callback when thumbnail fails to load */
  onThumbnailError?: () => void;
}

const confidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return 'border-green-500 bg-green-500/20';
  if (confidence >= 0.6) return 'border-yellow-500 bg-yellow-500/20';
  return 'border-red-500 bg-red-500/20';
};

const confidenceTextColor = (confidence: number): string => {
  if (confidence >= 0.8) return 'bg-green-500 text-white';
  if (confidence >= 0.6) return 'bg-yellow-500 text-white';
  return 'bg-red-500 text-white';
};

/**
 * Converts a normalized bounding box (0-1) to percentage-based CSS values
 */
function normalizedToPercent(bbox: NormalizedBoundingBox): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${bbox.x * 100}%`,
    top: `${bbox.y * 100}%`,
    width: `${bbox.width * 100}%`,
    height: `${bbox.height * 100}%`,
  };
}

export function CameraFeed({
  width = 640,
  height = 480,
  detections = [],
  visionDetections = [],
  showOverlay = true,
  isProcessing = false,
  thumbnailUrl,
  thumbnailAlt = 'Camera feed',
  onThumbnailError,
}: CameraFeedProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Determine if we have a valid thumbnail to show
  const showThumbnail = thumbnailUrl && !imageError;

  // Calculate total detection count
  const totalDetections = detections.length + visionDetections.length;

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
    onThumbnailError?.();
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  // Reset image state when URL changes
  const handleImageUrlChange = (url: string | null | undefined) => {
    if (url !== thumbnailUrl) {
      setImageError(false);
      setImageLoaded(false);
    }
  };

  // Effect to reset state on URL change
  if (thumbnailUrl) {
    handleImageUrlChange(thumbnailUrl);
  }

  return (
    <div 
      className="relative bg-gray-900 rounded-lg overflow-hidden w-full max-w-[640px]"
      style={{ aspectRatio: `${width}/${height}` }}
    >
      {/* Thumbnail image (when available) */}
      {showThumbnail && (
        <img
          src={thumbnailUrl}
          alt={thumbnailAlt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}

      {/* Placeholder background with grid pattern (shown when no thumbnail or loading) */}
      {(!showThumbnail || !imageLoaded) && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(to right, #fff 1px, transparent 1px),
                linear-gradient(to bottom, #fff 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
        </div>
      )}

      {/* Camera icon placeholder (shown when no thumbnail) */}
      {!showThumbnail && !isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg 
              className="w-16 h-16 mx-auto mb-2 opacity-50" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
              />
            </svg>
            <p className="text-sm">Camera Feed</p>
            <p className="text-xs opacity-75">{width} × {height}</p>
          </div>
        </div>
      )}

      {/* Legacy detection overlays (pixel-based bounding boxes) */}
      {showOverlay && detections.map((detection, index) => {
        const [x, y, boxWidth, boxHeight] = detection.bbox;
        const confidencePercent = Math.round(detection.confidence * 100);
        
        return (
          <div
            key={`legacy-${detection.label}-${index}`}
            className={`absolute border-2 ${confidenceColor(detection.confidence)}`}
            style={{
              left: x,
              top: y,
              width: boxWidth,
              height: boxHeight,
            }}
          >
            {/* Label with confidence */}
            <div 
              className={`absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium rounded-t whitespace-nowrap ${confidenceTextColor(detection.confidence)}`}
            >
              {detection.label} ({confidencePercent}%)
            </div>
          </div>
        );
      })}

      {/* Vision detection overlays (normalized bounding boxes) */}
      {showOverlay && visionDetections.map((detection, index) => {
        const percentBbox = normalizedToPercent(detection.bbox);
        const confidencePercent = Math.round(detection.confidence * 100);
        
        return (
          <div
            key={`vision-${detection.label}-${index}`}
            className={`absolute border-2 ${confidenceColor(detection.confidence)}`}
            style={percentBbox}
          >
            {/* Label with confidence */}
            <div 
              className={`absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium rounded-t whitespace-nowrap ${confidenceTextColor(detection.confidence)}`}
            >
              {detection.label} ({confidencePercent}%)
            </div>
          </div>
        );
      })}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-center text-white">
            <svg 
              className="animate-spin w-8 h-8 mx-auto mb-2" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
              />
            </svg>
            <p className="text-sm">Processing...</p>
          </div>
        </div>
      )}

      {/* Detection count badge */}
      {showOverlay && totalDetections > 0 && (
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
          {totalDetections} object{totalDetections !== 1 ? 's' : ''} detected
        </div>
      )}

      {/* Live indicator (when showing real thumbnail) */}
      {showThumbnail && imageLoaded && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live
        </div>
      )}
    </div>
  );
}
