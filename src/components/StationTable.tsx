/**
 * HeySalad QC - StationTable Component
 * 
 * Displays stations in a table with columns: name, type, created date, QR preview.
 * Includes action buttons per row. Responsive with card view on mobile.
 * Requirements: 1.2, 6.2
 */

import { Link } from 'react-router-dom';
import type { Station } from '../types';
import { Button } from './Button';
import { QRCodePreview } from './QRCodePreview';

export interface StationTableProps {
  stations: Station[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onGenerateMat: (id: string) => void;
  isLoading?: boolean;
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

export function StationTable({
  stations,
  selectedIds,
  onSelect,
  onSelectAll,
  onEdit,
  onDelete,
  onGenerateMat,
  isLoading = false,
}: StationTableProps) {
  const allSelected = stations.length > 0 && selectedIds.length === stations.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < stations.length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-tomato" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-2 text-gray-600">Loading stations...</span>
        </div>
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No stations</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new station.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {/* Select All Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-tomato focus:ring-tomato"
              aria-label="Select all stations"
            />
            Select all
          </label>
          <span className="text-xs text-gray-500">{stations.length} stations</span>
        </div>

        {/* Station Cards */}
        {stations.map((station) => (
          <div 
            key={station.id} 
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(station.id)}
                onChange={(e) => onSelect(station.id, e.target.checked)}
                className="h-4 w-4 mt-1 rounded border-gray-300 text-tomato focus:ring-tomato"
                aria-label={`Select ${station.name}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link 
                      to={`/station/${station.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-tomato"
                    >
                      {station.name}
                    </Link>
                    {station.location && (
                      <p className="text-xs text-gray-500 mt-0.5">{station.location}</p>
                    )}
                  </div>
                  <QRCodePreview stationId={station.id} size={40} />
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stationTypeColors[station.type] || 'bg-gray-100 text-gray-800'}`}>
                    {stationTypeLabels[station.type] || station.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(station.created_at)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Link
                    to={`/station/${station.id}`}
                    className="flex-1 text-center px-3 py-1.5 text-xs font-medium text-tomato bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(station.id)}
                    aria-label={`Edit ${station.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onGenerateMat(station.id)}
                    aria-label={`Generate mat for ${station.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(station.id)}
                    aria-label={`Delete ${station.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-tomato focus:ring-tomato"
                    aria-label="Select all stations"
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  QR Code
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stations.map((station) => (
                <tr key={station.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(station.id)}
                      onChange={(e) => onSelect(station.id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-tomato focus:ring-tomato"
                      aria-label={`Select ${station.name}`}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <Link 
                        to={`/station/${station.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-tomato"
                      >
                        {station.name}
                      </Link>
                      {station.location && (
                        <span className="text-xs text-gray-500">{station.location}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stationTypeColors[station.type] || 'bg-gray-100 text-gray-800'}`}>
                      {stationTypeLabels[station.type] || station.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {formatDate(station.created_at)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <QRCodePreview stationId={station.id} size={48} />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(station.id)}
                        aria-label={`Edit ${station.name}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onGenerateMat(station.id)}
                        aria-label={`Generate mat for ${station.name}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onDelete(station.id)}
                        aria-label={`Delete ${station.name}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
