/**
 * HeySalad QC - LayoutPicker Component
 * 
 * Radio button group for selecting mat layout (1x1, 2x1, 2x2).
 * Requirements: 2.1
 */

import type { MatLayout } from '../types';

export interface LayoutPickerProps {
  /** Currently selected layout */
  value: MatLayout;
  /** Callback when layout changes */
  onChange: (layout: MatLayout) => void;
  /** Label for the picker */
  label?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface LayoutOption {
  value: MatLayout;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const layoutOptions: LayoutOption[] = [
  {
    value: '1x1',
    label: '1×1',
    description: 'Single detection zone',
    icon: (
      <svg className="w-8 h-10" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="28" height="36" rx="1" />
        <rect x="6" y="8" width="20" height="24" strokeDasharray="4 2" />
      </svg>
    ),
  },
  {
    value: '2x1',
    label: '2×1',
    description: 'Two zones horizontal',
    icon: (
      <svg className="w-8 h-10" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="28" height="36" rx="1" />
        <rect x="4" y="8" width="10" height="24" strokeDasharray="4 2" />
        <rect x="18" y="8" width="10" height="24" strokeDasharray="4 2" />
      </svg>
    ),
  },
  {
    value: '2x2',
    label: '2×2',
    description: 'Four zones grid',
    icon: (
      <svg className="w-8 h-10" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="28" height="36" rx="1" />
        <rect x="4" y="6" width="10" height="12" strokeDasharray="4 2" />
        <rect x="18" y="6" width="10" height="12" strokeDasharray="4 2" />
        <rect x="4" y="22" width="10" height="12" strokeDasharray="4 2" />
        <rect x="18" y="22" width="10" height="12" strokeDasharray="4 2" />
      </svg>
    ),
  },
];

export function LayoutPicker({
  value,
  onChange,
  label = 'Layout',
  disabled = false,
  className = '',
}: LayoutPickerProps) {
  return (
    <fieldset className={className} disabled={disabled}>
      {label && (
        <legend className="block text-sm font-medium text-gray-700 mb-3">
          {label}
        </legend>
      )}
      <div className="grid grid-cols-3 gap-3">
        {layoutOptions.map((option) => {
          const isSelected = value === option.value;
          return (
            <label
              key={option.value}
              className={`
                relative flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer
                transition-all duration-150
                ${isSelected
                  ? 'border-tomato bg-red-50 text-tomato'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input
                type="radio"
                name="layout"
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                className="sr-only"
                aria-describedby={`layout-${option.value}-description`}
              />
              <div className={isSelected ? 'text-tomato' : 'text-gray-400'}>
                {option.icon}
              </div>
              <span className="mt-2 font-semibold text-sm">{option.label}</span>
              <span
                id={`layout-${option.value}-description`}
                className="text-xs text-gray-500 text-center mt-1"
              >
                {option.description}
              </span>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <svg className="w-4 h-4 text-tomato" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
