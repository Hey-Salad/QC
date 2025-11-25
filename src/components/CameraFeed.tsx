/**
 * HeySalad QC - CameraFeed Component
 * 
 * 640x480 placeholder with detection overlay support.
 * Displays bounding boxes, confidence scores, and object labels.
 * Responsive design that scales on mobile devices.
 * Requirements: 3.2, 3.3, 6.2
 */

import type { DetectedObject } from '../types';

export interface CameraFeedProps {
  width?: number;
  height?: number;
  detections?: DetectedObject[];
  showOverlay?: boolean;
  isProcessing?: boolean;
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

export function CameraFeed({
  width = 640,
  height = 480,
  detections = [],
  showOverlay = true,
  isProcessing = false,
}: CameraFeedProps) {
  return (
    <div 
      className="relative bg-gray-900 rounded-lg overflow-hidden w-full max-w-[640px]"
      style={{ aspectRatio: `${width}/${height}` }}
    >
      {/* Placeholder background with grid pattern */}
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

      {/* Camera icon placeholder */}
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

      {/* Detection overlays */}
      {showOverlay && detections.map((detection, index) => {
        const [x, y, boxWidth, boxHeight] = detection.bbox;
        const confidencePercent = Math.round(detection.confidence * 100);
        
        return (
          <div
            key={`${detection.label}-${index}`}
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
              className={`absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium rounded-t ${confidenceTextColor(detection.confidence)}`}
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
      {showOverlay && detections.length > 0 && (
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
          {detections.length} object{detections.length !== 1 ? 's' : ''} detected
        </div>
      )}
    </div>
  );
}
