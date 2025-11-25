/**
 * HeySalad QC - Checklist Component
 * 
 * Display expected vs detected items with checkmarks/X marks.
 * Shows overall pass/fail status.
 * Requirements: 3.4
 */

import type { ChecklistItemResult } from '../lib/checklist';
import { AlertBadge } from './AlertBadge';

export interface ChecklistProps {
  items: ChecklistItemResult[];
  pass: boolean;
  showConfidence?: boolean;
  title?: string;
}

export function Checklist({
  items,
  pass,
  showConfidence = true,
  title = 'Detection Checklist',
}: ChecklistProps) {
  const foundCount = items.filter(item => item.found).length;
  const totalCount = items.length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {foundCount} of {totalCount} items detected
          </p>
        </div>
        <AlertBadge status={pass ? 'pass' : 'fail'} size="md" />
      </div>

      {/* Items list */}
      <ul className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <li className="px-4 py-3 text-sm text-gray-500 text-center">
            No items to check
          </li>
        ) : (
          items.map((item, index) => (
            <li 
              key={`${item.label}-${index}`}
              className={`px-4 py-3 flex items-center justify-between ${
                item.found ? 'bg-white' : 'bg-red-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <span 
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    item.found 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {item.found ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </span>

                {/* Item label */}
                <div>
                  <span className={`text-sm font-medium ${item.found ? 'text-gray-900' : 'text-red-700'}`}>
                    {item.label}
                  </span>
                  {item.required && (
                    <span className="ml-2 text-xs text-red-500 font-medium">Required</span>
                  )}
                </div>
              </div>

              {/* Confidence score */}
              {showConfidence && item.confidence !== null && (
                <span 
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    item.confidence >= 0.8 
                      ? 'bg-green-100 text-green-700'
                      : item.confidence >= 0.6
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {Math.round(item.confidence * 100)}%
                </span>
              )}
              
              {/* Missing indicator */}
              {!item.found && (
                <span className="text-xs text-red-600 font-medium">
                  Missing
                </span>
              )}
            </li>
          ))
        )}
      </ul>

      {/* Summary footer */}
      <div className={`px-4 py-3 border-t ${pass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <p className={`text-sm font-medium ${pass ? 'text-green-700' : 'text-red-700'}`}>
          {pass 
            ? '✓ All required items detected' 
            : '✗ Missing required items'
          }
        </p>
      </div>
    </div>
  );
}
