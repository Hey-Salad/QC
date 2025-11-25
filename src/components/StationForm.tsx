/**
 * HeySalad QC - StationForm Component
 * 
 * Form for creating/editing stations with name, type, location, description.
 * Includes validation feedback.
 * Requirements: 1.1, 1.3
 */

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import type { Station, StationType, CreateStationInput, UpdateStationInput } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import {
  validateStationName,
  validateStationLocation,
  validateStationDescription,
  isValidStationType,
} from '../lib/validation';

export interface StationFormProps {
  /** Station to edit (null for create mode) */
  station?: Station | null;
  /** Called when form is submitted with valid data */
  onSubmit: (data: CreateStationInput | UpdateStationInput) => Promise<void>;
  /** Called when form is cancelled */
  onCancel: () => void;
  /** Whether form submission is in progress */
  isSubmitting?: boolean;
}

interface FormErrors {
  name?: string;
  type?: string;
  location?: string;
  description?: string;
}

const stationTypeOptions = [
  { value: 'packing', label: 'Packing' },
  { value: 'prep', label: 'Prep' },
  { value: 'storage', label: 'Storage' },
  { value: 'receiving', label: 'Receiving' },
];

export function StationForm({
  station,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: StationFormProps) {
  const isEditMode = !!station;

  const [name, setName] = useState(station?.name ?? '');
  const [type, setType] = useState<StationType | ''>(station?.type ?? '');
  const [location, setLocation] = useState(station?.location ?? '');
  const [description, setDescription] = useState(station?.description ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset form when station changes
  useEffect(() => {
    setName(station?.name ?? '');
    setType(station?.type ?? '');
    setLocation(station?.location ?? '');
    setDescription(station?.description ?? '');
    setErrors({});
    setTouched({});
  }, [station]);

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'name': {
        const result = validateStationName(value);
        return result.valid ? undefined : result.errors[0];
      }
      case 'type': {
        if (!value) return 'Type is required';
        if (!isValidStationType(value)) return 'Invalid station type';
        return undefined;
      }
      case 'location': {
        const result = validateStationLocation(value || undefined);
        return result.valid ? undefined : result.errors[0];
      }
      case 'description': {
        const result = validateStationDescription(value || undefined);
        return result.valid ? undefined : result.errors[0];
      }
      default:
        return undefined;
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    
    let value: string;
    switch (field) {
      case 'name':
        value = name;
        break;
      case 'type':
        value = type;
        break;
      case 'location':
        value = location;
        break;
      case 'description':
        value = description;
        break;
      default:
        return;
    }
    
    const error = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      name: validateField('name', name),
      type: validateField('type', type),
      location: validateField('location', location),
      description: validateField('description', description),
    };

    setErrors(newErrors);
    setTouched({ name: true, type: true, location: true, description: true });

    return !Object.values(newErrors).some((error) => error !== undefined);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data: CreateStationInput | UpdateStationInput = {
      name: name.trim(),
      type: type as StationType,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    };

    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Station Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => handleBlur('name')}
        error={touched.name ? errors.name : undefined}
        placeholder="e.g., Packing Station 1"
        required
        disabled={isSubmitting}
        maxLength={100}
      />

      <Select
        label="Station Type"
        value={type}
        onChange={(e) => setType(e.target.value as StationType | '')}
        onBlur={() => handleBlur('type')}
        error={touched.type ? errors.type : undefined}
        options={stationTypeOptions}
        placeholder="Select a type..."
        required
        disabled={isSubmitting}
      />

      <Input
        label="Location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        onBlur={() => handleBlur('location')}
        error={touched.location ? errors.location : undefined}
        placeholder="e.g., Kitchen Area A"
        helperText="Optional - physical location of the station"
        disabled={isSubmitting}
        maxLength={200}
      />

      <div className="w-full">
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => handleBlur('description')}
          placeholder="e.g., Main packing station for delivery orders"
          className={`block w-full rounded-md border px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm ${
            touched.description && errors.description
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-tomato focus:ring-tomato'
          }`}
          rows={3}
          disabled={isSubmitting}
          maxLength={500}
        />
        {touched.description && errors.description ? (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.description}
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-500">
            Optional - brief description of the station's purpose
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
        >
          {isEditMode ? 'Update Station' : 'Create Station'}
        </Button>
      </div>
    </form>
  );
}
