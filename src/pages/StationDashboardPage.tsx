/**
 * HeySalad QC - Station Dashboard Page
 * 
 * Station dashboard with camera feed, checklist, detection log, and manual scan.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Station, DetectionLogEntry, DetectionRules, DetectionResult, ExpectedItem } from '../types';
import type { ChecklistItemResult } from '../lib/checklist';
import { Button, AlertBadge, CameraFeed, Checklist, DetectionLog } from '../components';
import { API_BASE } from '../lib/config';

export interface StationDashboardPageProps {
  stationId?: string;
}

// Default expected items for demo when no rules are configured
const DEFAULT_EXPECTED_ITEMS: ExpectedItem[] = [
  { label: 'lettuce', required: true },
  { label: 'tomato', required: true },
  { label: 'container', required: true },
  { label: 'lid', required: false },
];

export function StationDashboardPage({ stationId: propStationId }: StationDashboardPageProps = {}) {
  const { id: paramStationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stationId = propStationId || paramStationId || '';
  // Station data
  const [station, setStation] = useState<Station | null>(null);
  const [isLoadingStation, setIsLoadingStation] = useState(true);
  const [stationError, setStationError] = useState<string | null>(null);

  // Detection rules
  const [rules, setRules] = useState<DetectionRules | null>(null);

  // Detection logs
  const [logs, setLogs] = useState<DetectionLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Current detection state
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Fetch station details
  const fetchStation = useCallback(async () => {
    setIsLoadingStation(true);
    setStationError(null);
    try {
      const response = await fetch(`${API_BASE}/stations/${stationId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Station not found');
        }
        throw new Error('Failed to fetch station');
      }
      const data: Station = await response.json();
      setStation(data);
    } catch (err) {
      setStationError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingStation(false);
    }
  }, [stationId]);

  // Fetch detection rules
  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/stations/${stationId}/rules`);
      if (response.ok) {
        const data: DetectionRules = await response.json();
        setRules(data);
      }
    } catch {
      // Rules are optional, ignore errors
    }
  }, [stationId]);

  // Fetch detection logs
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch(`${API_BASE}/stations/${stationId}/logs?limit=20`);
      if (response.ok) {
        const data: DetectionLogEntry[] = await response.json();
        setLogs(data);
      }
    } catch {
      // Logs are optional, ignore errors
    } finally {
      setIsLoadingLogs(false);
    }
  }, [stationId]);

  // Initial data fetch
  useEffect(() => {
    fetchStation();
    fetchRules();
    fetchLogs();
  }, [fetchStation, fetchRules, fetchLogs]);

  // Manual scan handler
  const handleManualScan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await fetch(`${API_BASE}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: stationId,
          image_data: 'mock-image-data', // Mock data for testing
        }),
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const result: DetectionResult = await response.json();
      setCurrentDetection(result);
      
      // Refresh logs after scan
      await fetchLogs();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Get expected items from rules or use defaults
  const expectedItems = rules?.expected_items ?? DEFAULT_EXPECTED_ITEMS;

  // Convert current detection to checklist items
  const checklistItems: ChecklistItemResult[] = expectedItems.map(item => {
    const detected = currentDetection?.detected_objects.find(
      d => d.label.toLowerCase() === item.label.toLowerCase()
    );
    return {
      label: item.label,
      required: item.required,
      found: !!detected,
      confidence: detected?.confidence ?? null,
    };
  });

  const checklistPass = currentDetection?.pass ?? 
    checklistItems.every(item => !item.required || item.found);

  // Station type labels
  const stationTypeLabels: Record<string, string> = {
    packing: 'Packing Station',
    prep: 'Prep Station',
    storage: 'Storage Area',
    receiving: 'Receiving Station',
  };

  // Loading state
  if (isLoadingStation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg 
            className="animate-spin w-8 h-8 mx-auto text-tomato" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 mt-2">Loading station...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (stationError || !station) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 mt-4">Station Not Found</h2>
          <p className="text-gray-500 mt-1">{stationError || 'Unable to load station'}</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Station Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{station.name}</h1>
              {currentDetection && (
                <AlertBadge 
                  status={currentDetection.pass ? 'pass' : 'fail'} 
                  size="lg"
                />
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stationTypeLabels[station.type] || station.type}
              {station.location && ` • ${station.location}`}
            </p>
            {station.description && (
              <p className="text-sm text-gray-600 mt-2">{station.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/station/${stationId}/configure`}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure
            </Link>
          </div>
        </div>
      </div>

      {/* Scan Error Alert */}
      {scanError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700">{scanError}</p>
            </div>
            <button
              className="ml-auto text-red-400 hover:text-red-600"
              onClick={() => setScanError(null)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Camera Feed - Takes 2 columns on desktop */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Camera Feed</h2>
              <Button
                variant="primary"
                onClick={handleManualScan}
                isLoading={isScanning}
                className="w-full sm:w-auto"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Manual Scan
              </Button>
            </div>
            
            <div className="flex justify-center">
              <CameraFeed
                width={640}
                height={480}
                detections={currentDetection?.detected_objects}
                showOverlay={!!currentDetection}
                isProcessing={isScanning}
              />
            </div>

            {/* Detection summary */}
            {currentDetection && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                  <span className="text-gray-600">
                    Last scan: {new Date(currentDetection.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-gray-600">
                    {currentDetection.detected_objects.length} objects detected
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Checklist - Takes 1 column on desktop */}
        <div>
          <Checklist
            items={checklistItems}
            pass={checklistPass}
            showConfidence={true}
            title="Detection Checklist"
          />
        </div>
      </div>

      {/* Detection Log - Full width */}
      <DetectionLog
        logs={logs}
        maxEntries={20}
        isLoading={isLoadingLogs}
      />
    </div>
  );
}
