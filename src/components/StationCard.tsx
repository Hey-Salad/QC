/**
 * HeySalad QC - StationCard Component
 * 
 * Displays station information with action buttons for edit, delete, and generate mat.
 * Requirements: 6.3
 */

import type { Station } from '../types';
import { Button } from './Button';

export interface StationCardProps {
  station: Station;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onGenerateMat: (id: string) => void;
  showQRPreview?: boolean;
  qrPreviewUrl?: string;
}

const stationTypeLabels: Record<string, string> = {
  packing: 'Packing',
  prep: 'Prep',
  storage: 'Storage',
  receiving: 'Receiving',
};

const stationTypeColors: Record<string, string> = {
  packing: 'bg-blue-100 text-blue-800',
  prep: 'bg-purple-100 text-purple-800',
  storage: 'bg-amber-100 text-amber-800',
  receiving: 'bg-teal-100 text-teal-800',
};

export function StationCard({ 
  station, 
  onEdit, 
  onDelete, 
  onGenerateMat,
  showQRPreview = false,
  qrPreviewUrl
}: StationCardProps) {
  const formattedDate = new Date(station.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Station Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {station.name}
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stationTypeColors[station.type] || 'bg-gray-100 text-gray-800'}`}>
              {stationTypeLabels[station.type] || station.type}
            </span>
          </div>
          
          {station.location && (
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Location:</span> {station.location}
            </p>
          )}
          
          {station.description && (
            <p className="text-sm text-gray-500 mb-2 line-clamp-2">
              {station.description}
            </p>
          )}
          
          <p className="text-xs text-gray-400">
            Created: {formattedDate}
          </p>
        </div>

        {/* QR Preview */}
        {showQRPreview && qrPreviewUrl && (
          <div className="flex-shrink-0">
            <img 
              src={qrPreviewUrl} 
              alt={`QR code for ${station.name}`}
              className="w-16 h-16 rounded border border-gray-200"
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(station.id)}
          aria-label={`Edit ${station.name}`}
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onGenerateMat(station.id)}
          aria-label={`Generate mat for ${station.name}`}
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Generate Mat
        </Button>
        
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(station.id)}
          aria-label={`Delete ${station.name}`}
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </Button>
      </div>
    </div>
  );
}
