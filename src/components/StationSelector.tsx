/**
 * HeySalad QC - StationSelector Component
 * 
 * Dropdown component for selecting a station, populated from /api/stations.
 * Requirements: 2.1
 */

import { useState, useEffect } from 'react';
import type { Station } from '../types';
import { Select } from './Select';
import { API_BASE } from '../lib/config';

export interface StationSelectorProps {
  /** Currently selected station ID */
  value: string;
  /** Callback when selection changes */
  onChange: (stationId: string, station: Station | null) => void;
  /** Label for the select */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function StationSelector({
  value,
  onChange,
  label = 'Select Station',
  error,
  disabled = false,
  className = '',
}: StationSelectorProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStations = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(`${API_BASE}/stations`);
        if (!response.ok) {
          throw new Error('Failed to fetch stations');
        }
        const data: Station[] = await response.json();
        setStations(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load stations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStations();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stationId = e.target.value;
    const station = stations.find((s) => s.id === stationId) || null;
    onChange(stationId, station);
  };

  const options = stations.map((station) => ({
    value: station.id,
    label: `${station.name} (${station.type})`,
  }));

  const displayError = error || fetchError;

  return (
    <div className={className}>
      <Select
        label={label}
        value={value}
        onChange={handleChange}
        options={options}
        placeholder={isLoading ? 'Loading stations...' : 'Select a station'}
        error={displayError || undefined}
        disabled={disabled || isLoading}
        helperText={
          !displayError && stations.length === 0 && !isLoading
            ? 'No stations available. Create one in the Admin page.'
            : undefined
        }
      />
    </div>
  );
}
