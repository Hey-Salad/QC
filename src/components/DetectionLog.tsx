/**
 * HeySalad QC - DetectionLog Component
 * 
 * Table of last 20 detections with timestamps, thumbnails, and status.
 * Requirements: 3.5
 */

import type { DetectionLogEntry } from '../types';
import { AlertBadge } from './AlertBadge';

export interface DetectionLogProps {
  logs: DetectionLogEntry[];
  maxEntries?: number;
  onViewDetails?: (id: string) => void;
  isLoading?: boolean;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

export function DetectionLog({
  logs,
  maxEntries = 20,
  onViewDetails,
  isLoading = false,
}: DetectionLogProps) {
  const displayLogs = logs.slice(0, maxEntries);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Detection History</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Last {Math.min(logs.length, maxEntries)} detections
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="px-4 py-8 text-center">
          <svg 
            className="animate-spin w-6 h-6 mx-auto text-gray-400" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4" 
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
            />
          </svg>
          <p className="text-sm text-gray-500 mt-2">Loading history...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayLogs.length === 0 && (
        <div className="px-4 py-8 text-center">
          <svg 
            className="w-12 h-12 mx-auto text-gray-300" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
            />
          </svg>
          <p className="text-sm text-gray-500 mt-2">No detection history yet</p>
          <p className="text-xs text-gray-400">Run a scan to see results here</p>
        </div>
      )}

      {/* Log entries table */}
      {!isLoading && displayLogs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thumbnail
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detected
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                {onViewDetails && (
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {displayLogs.map((log) => (
                <tr 
                  key={log.id} 
                  className={`hover:bg-gray-50 ${log.pass_fail === 'fail' ? 'bg-red-50/50' : ''}`}
                >
                  {/* Timestamp */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatRelativeTime(log.timestamp)}</div>
                    <div className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</div>
                  </td>

                  {/* Thumbnail */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {log.image_url ? (
                      <img 
                        src={log.image_url} 
                        alt="Detection thumbnail"
                        className="w-12 h-9 object-cover rounded border border-gray-200"
                      />
                    ) : (
                      <div className="w-12 h-9 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </td>

                  {/* Detected items count */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {log.detected_items.length} item{log.detected_items.length !== 1 ? 's' : ''}
                    </span>
                    {log.detected_items.length > 0 && (
                      <div className="text-xs text-gray-500 truncate max-w-[150px]">
                        {log.detected_items.map(d => d.label).join(', ')}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AlertBadge 
                      status={log.pass_fail === 'pass' ? 'pass' : 'fail'} 
                      size="sm" 
                    />
                  </td>

                  {/* Actions */}
                  {onViewDetails && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => onViewDetails(log.id)}
                        className="text-sm text-tomato hover:text-red-700 font-medium"
                      >
                        View
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer with count */}
      {!isLoading && logs.length > maxEntries && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Showing {maxEntries} of {logs.length} entries
          </p>
        </div>
      )}
    </div>
  );
}
