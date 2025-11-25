/**
 * HeySalad QC - Generate Page
 * 
 * Page for generating printable QR code mats with station selection,
 * layout picker, live mat preview, and download functionality.
 * Requirements: 2.1, 2.2, 2.3
 */

import { useState } from 'react';
import type { Station, MatLayout } from '../types';
import { Button, MatPreview } from '../components';
import { StationSelector } from '../components/StationSelector';
import { LayoutPicker } from '../components/LayoutPicker';
import { generateMatPDF, generateMatFilename } from '../lib/mat-generator';

export function GeneratePage() {
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [layout, setLayout] = useState<MatLayout>('1x1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStationChange = (stationId: string, station: Station | null) => {
    setSelectedStationId(stationId);
    setSelectedStation(station);
    setError(null);
  };

  const handleLayoutChange = (newLayout: MatLayout) => {
    setLayout(newLayout);
  };

  const handleDownload = async () => {
    if (!selectedStation) {
      setError('Please select a station first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate PDF client-side
      const pdfData = await generateMatPDF(selectedStation, layout);
      const filename = generateMatFilename(selectedStation, layout);
      
      // Create download
      const blob = new Blob([pdfData], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  // Create a placeholder station for preview when none selected
  const previewStation: Station = selectedStation || {
    id: 'preview-station',
    name: 'Sample Station',
    type: 'packing',
    location: null,
    description: null,
    qr_code_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate QC Mat</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create printable A4 mats with QR codes for your QC stations
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              className="ml-auto text-red-400 hover:text-red-600"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Configuration Panel */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Configuration</h2>
            
            {/* Station Selector */}
            <StationSelector
              value={selectedStationId}
              onChange={handleStationChange}
              label="Station"
            />

            {/* Layout Picker */}
            <LayoutPicker
              value={layout}
              onChange={handleLayoutChange}
              label="Mat Layout"
            />

            {/* Station Details */}
            {selectedStation && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Station Details</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Name:</dt>
                    <dd className="text-gray-900 font-medium">{selectedStation.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type:</dt>
                    <dd className="text-gray-900 capitalize">{selectedStation.type}</dd>
                  </div>
                  {selectedStation.location && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Location:</dt>
                      <dd className="text-gray-900">{selectedStation.location}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Download Button */}
            <div className="pt-4">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleDownload}
                isLoading={isGenerating}
                disabled={!selectedStationId}
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </Button>
              <p className="mt-2 text-xs text-gray-500 text-center">
                A4 format (210mm × 297mm) at 300 DPI
              </p>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Live Preview</h2>
            
            <div className="flex justify-center bg-gray-100 rounded-lg p-4">
              <MatPreview
                station={previewStation}
                layout={layout}
                scale={0.4}
                showQRCode={!!selectedStation}
              />
            </div>

            {!selectedStation && (
              <p className="mt-4 text-sm text-gray-500 text-center">
                Select a station to see the actual QR code in the preview
              </p>
            )}
          </div>

          {/* Layout Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Layout Information</h3>
            <p className="text-sm text-blue-700">
              {layout === '1x1' && 'Single detection zone - ideal for individual item inspection.'}
              {layout === '2x1' && 'Two horizontal zones - great for comparing items side by side.'}
              {layout === '2x2' && 'Four-zone grid - perfect for batch inspection of multiple items.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
