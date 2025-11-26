/**
 * HeySalad QC - useVisionDetection Hook
 * 
 * Polls /api/vision/latest/:station_id every 2 seconds to get
 * the latest detection results and thumbnail URL.
 * 
 * Requirements: 4.2, 4.4
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LatestDetectionResponse, VisionDetection, VisionDetectedObject } from '../types';
import { API_BASE } from '../lib/config';

export interface UseVisionDetectionOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
}

export interface UseVisionDetectionResult {
  /** Latest detection result */
  detection: VisionDetection | null;
  /** Thumbnail URL for the latest detection */
  thumbnailUrl: string | null;
  /** Detected objects from the latest detection */
  objects: VisionDetectedObject[];
  /** Whether the hook is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Timestamp of last successful fetch */
  lastUpdated: Date | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

/**
 * Hook to poll for the latest vision detection for a station.
 * 
 * @param stationId - The station ID to poll detections for
 * @param options - Configuration options
 * @returns Detection state and controls
 */
export function useVisionDetection(
  stationId: string | null | undefined,
  options: UseVisionDetectionOptions = {}
): UseVisionDetectionResult {
  const { pollInterval = 2000, enabled = true } = options;

  const [detection, setDetection] = useState<VisionDetection | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);
  // Track the current station ID to handle changes
  const currentStationIdRef = useRef(stationId);

  const fetchLatestDetection = useCallback(async () => {
    if (!stationId) {
      return;
    }

    // Update current station ref
    currentStationIdRef.current = stationId;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/vision/latest/${stationId}`);

      // Check if station changed during fetch
      if (currentStationIdRef.current !== stationId || !isMountedRef.current) {
        return;
      }

      if (!response.ok) {
        if (response.status === 404) {
          // No detections yet - not an error, just no data
          setDetection(null);
          setThumbnailUrl(null);
          setError(null);
          return;
        }
        throw new Error(`Failed to fetch detection: ${response.status}`);
      }

      const data: LatestDetectionResponse = await response.json();

      if (!isMountedRef.current) {
        return;
      }

      setDetection(data.detection);
      setThumbnailUrl(data.thumbnail_url || null);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch detection');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [stationId]);

  // Reset state when station changes
  useEffect(() => {
    setDetection(null);
    setThumbnailUrl(null);
    setError(null);
    setLastUpdated(null);
  }, [stationId]);

  // Set up polling
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !stationId) {
      return;
    }

    // Initial fetch
    fetchLatestDetection();

    // Set up polling interval
    const intervalId = setInterval(fetchLatestDetection, pollInterval);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [enabled, stationId, pollInterval, fetchLatestDetection]);

  // Extract objects for convenience
  const objects = detection?.objects ?? [];

  return {
    detection,
    thumbnailUrl,
    objects,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchLatestDetection,
  };
}
