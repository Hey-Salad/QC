/**
 * HeySalad QC - Configure Page
 * 
 * Configure detection rules for a station: expected items, threshold, alerts.
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Station, DetectionRules, ExpectedItem, AlertConfig as AlertConfigType, DetectionRulesInput } from '../types';
import { Button } from '../components/Button';
import { ExpectedItemsList } from '../components/ExpectedItemsList';
import { ThresholdSlider } from '../components/ThresholdSlider';
import { AlertConfig } from '../components/AlertConfig';

const API_BASE = '/api';

export interface ConfigurePageProps {
  stationId?: string;
}

const DEFAULT_ALERT_CONFIG: AlertConfigType = {
  enabled: false,
  triggers: [],
};

const DEFAULT_THRESHOLD = 0.75;

export function ConfigurePage({ stationId: propStationId }: ConfigurePageProps = {}) {
  const { id: paramStationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stationId = propStationId || paramStationId || '';
  // Station data
  const [station, setStation] = useState<Station | null>(null);
  const [isLoadingStation, setIsLoadingStation] = useState(true);
  const [stationError, setStationError] = useState<string | null>(null);

  // Form state
  const [expectedItems, setExpectedItems] = useState<ExpectedItem[]>([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(DEFAULT_THRESHOLD);
  const [alertConfig, setAlertConfig] = useState<AlertConfigType>(DEFAULT_ALERT_CONFIG);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Track if form has unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

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

  // Fetch existing detection rules
  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/stations/${stationId}/rules`);
      if (response.ok) {
        const data: DetectionRules = await response.json();
        setExpectedItems(data.expected_items);
        setConfidenceThreshold(data.confidence_threshold);
        setAlertConfig(data.alert_config);
      }
    } catch {
      // Rules may not exist yet, use defaults
    }
  }, [stationId]);

  // Initial data fetch
  useEffect(() => {
    fetchStation();
    fetchRules();
  }, [fetchStation, fetchRules]);

  // Track changes
  const handleExpectedItemsChange = (items: ExpectedItem[]) => {
    setExpectedItems(items);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleThresholdChange = (value: number) => {
    setConfidenceThreshold(value);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleAlertConfigChange = (config: AlertConfigType) => {
    setAlertConfig(config);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Save handler
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const rulesInput: DetectionRulesInput = {
      expected_items: expectedItems,
      confidence_threshold: confidenceThreshold,
      alert_config: alertConfig,
    };

    try {
      const response = await fetch(`${API_BASE}/stations/${stationId}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulesInput),
      });

      if (!response.ok) {
        throw new Error('Failed to save detection rules');
      }

      setSaveSuccess(true);
      setHasChanges(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Configure Station</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1 ml-7">
              {station.name} • {stationTypeLabels[station.type] || station.type}
            </p>
          </div>
        </div>
      </div>

      {/* Save Error Alert */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700">{saveError}</p>
            </div>
            <button
              className="ml-auto text-red-400 hover:text-red-600"
              onClick={() => setSaveError(null)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Save Success Alert */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-green-700">Detection rules saved successfully!</p>
            </div>
            <button
              className="ml-auto text-green-400 hover:text-green-600"
              onClick={() => setSaveSuccess(false)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Expected Items Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <ExpectedItemsList
          items={expectedItems}
          onChange={handleExpectedItemsChange}
        />
      </div>

      {/* Confidence Threshold Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <ThresholdSlider
          value={confidenceThreshold}
          onChange={handleThresholdChange}
        />
      </div>

      {/* Alert Configuration Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <AlertConfig
          config={alertConfig}
          onChange={handleAlertConfigChange}
        />
      </div>

      {/* Save Button */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            {hasChanges && (
              <p className="text-sm text-amber-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                You have unsaved changes
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              to={`/station/${stationId}`}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
              disabled={!hasChanges}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
