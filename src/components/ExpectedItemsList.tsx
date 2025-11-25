/**
 * HeySalad QC - ExpectedItemsList Component
 * 
 * Add/remove expected items with required/optional toggle.
 * Requirements: 4.1, 4.3
 */

import { useState } from 'react';
import type { ExpectedItem } from '../types';
import { Button } from './Button';
import { Input } from './Input';

export interface ExpectedItemsListProps {
  items: ExpectedItem[];
  onChange: (items: ExpectedItem[]) => void;
}

export function ExpectedItemsList({ items, onChange }: ExpectedItemsListProps) {
  const [newItemLabel, setNewItemLabel] = useState('');

  const handleAddItem = () => {
    const label = newItemLabel.trim();
    if (!label) return;
    
    // Check for duplicates
    if (items.some(item => item.label.toLowerCase() === label.toLowerCase())) {
      return;
    }

    const newItem: ExpectedItem = {
      label,
      required: true,
    };
    onChange([...items, newItem]);
    setNewItemLabel('');
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleToggleRequired = (index: number) => {
    const updated = items.map((item, i) => 
      i === index ? { ...item, required: !item.required } : item
    );
    onChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Expected Items</h3>
        <span className="text-xs text-gray-500">{items.length} items</span>
      </div>

      {/* Add new item */}
      <div className="flex gap-2">
        <Input
          placeholder="Enter item name (e.g., lettuce, tomato)"
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddItem}
          disabled={!newItemLabel.trim()}
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </Button>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-gray-500 mt-2">No expected items yet</p>
          <p className="text-xs text-gray-400">Add items that should be detected at this station</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{item.label}</span>
                <button
                  type="button"
                  onClick={() => handleToggleRequired(index)}
                  className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                    item.required
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {item.required ? 'Required' : 'Optional'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label={`Remove ${item.label}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-500">
        Required items must be present for the station to pass inspection. Optional items are tracked but won't cause failures.
      </p>
    </div>
  );
}
