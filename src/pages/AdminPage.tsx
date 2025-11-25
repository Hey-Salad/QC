/**
 * HeySalad QC - Admin Page
 * 
 * Station management page with CRUD operations and bulk mat generation.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { useState, useEffect, useCallback } from 'react';
import type { Station, CreateStationInput, UpdateStationInput, MatLayout } from '../types';
import {
  Button,
  Modal,
  StationTable,
  StationForm,
  Select,
} from '../components';
import { generateMatPDF, generateMatFilename } from '../lib/mat-generator';
import { API_BASE } from '../lib/config';

interface DeleteConfirmState {
  isOpen: boolean;
  stationId: string | null;
  stationName: string;
}

interface GenerateMatState {
  isOpen: boolean;
  stationId: string | null;
  stationName: string;
  layout: MatLayout;
  isGenerating: boolean;
}

export function AdminPage() {
  // Station data state
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    stationId: null,
    stationName: '',
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Generate mat modal state
  const [generateMat, setGenerateMat] = useState<GenerateMatState>({
    isOpen: false,
    stationId: null,
    stationName: '',
    layout: '1x1',
    isGenerating: false,
  });

  // Bulk generate state
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  // Fetch stations
  const fetchStations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/stations`);
      if (!response.ok) {
        throw new Error('Failed to fetch stations');
      }
      const data: Station[] = await response.json();
      setStations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  // Selection handlers
  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) =>
      selected ? [...prev, id] : prev.filter((i) => i !== id)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? stations.map((s) => s.id) : []);
  };

  // Create/Edit handlers
  const handleOpenCreate = () => {
    setEditingStation(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const station = stations.find((s) => s.id === id);
    if (station) {
      setEditingStation(station);
      setIsFormOpen(true);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingStation(null);
  };

  const handleSubmitForm = async (data: CreateStationInput | UpdateStationInput) => {
    setIsSubmitting(true);
    try {
      if (editingStation) {
        // Update existing station
        const response = await fetch(`${API_BASE}/stations/${editingStation.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          throw new Error('Failed to update station');
        }
      } else {
        // Create new station
        const response = await fetch(`${API_BASE}/stations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          throw new Error('Failed to create station');
        }
      }
      handleCloseForm();
      await fetchStations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handlers
  const handleOpenDelete = (id: string) => {
    const station = stations.find((s) => s.id === id);
    if (station) {
      setDeleteConfirm({
        isOpen: true,
        stationId: id,
        stationName: station.name,
      });
    }
  };

  const handleCloseDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      stationId: null,
      stationName: '',
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.stationId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/stations/${deleteConfirm.stationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete station');
      }
      handleCloseDelete();
      setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirm.stationId));
      await fetchStations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  // Generate mat handlers
  const handleOpenGenerateMat = (id: string) => {
    const station = stations.find((s) => s.id === id);
    if (station) {
      setGenerateMat({
        isOpen: true,
        stationId: id,
        stationName: station.name,
        layout: '1x1',
        isGenerating: false,
      });
    }
  };

  const handleCloseGenerateMat = () => {
    setGenerateMat({
      isOpen: false,
      stationId: null,
      stationName: '',
      layout: '1x1',
      isGenerating: false,
    });
  };

  const handleGenerateMat = async () => {
    if (!generateMat.stationId) return;

    const station = stations.find((s) => s.id === generateMat.stationId);
    if (!station) return;

    setGenerateMat((prev) => ({ ...prev, isGenerating: true }));
    try {
      // Generate PDF client-side
      const pdfData = await generateMatPDF(station, generateMat.layout);
      const filename = generateMatFilename(station, generateMat.layout);
      
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
      
      handleCloseGenerateMat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerateMat((prev) => ({ ...prev, isGenerating: false }));
    }
  };

  // Bulk generate handler
  const handleBulkGenerate = async () => {
    if (selectedIds.length === 0) return;

    setIsBulkGenerating(true);
    try {
      // Generate mats for all selected stations sequentially
      let failedCount = 0;
      for (const stationId of selectedIds) {
        const station = stations.find((s) => s.id === stationId);
        if (!station) {
          failedCount++;
          continue;
        }
        
        try {
          const pdfData = await generateMatPDF(station, '1x1');
          const filename = generateMatFilename(station, '1x1');
          
          const blob = new Blob([pdfData], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          // Small delay between downloads
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch {
          failedCount++;
        }
      }

      if (failedCount > 0) {
        setError(`${failedCount} mat(s) failed to generate`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const layoutOptions = [
    { value: '1x1', label: '1x1 - Single zone' },
    { value: '2x1', label: '2x1 - Two zones horizontal' },
    { value: '2x2', label: '2x2 - Four zones grid' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Station Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage QC stations for your facility
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreate} className="w-full sm:w-auto">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Station
        </Button>
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
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-sm text-blue-700">
            {selectedIds.length} station(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkGenerate}
              isLoading={isBulkGenerating}
              className="flex-1 sm:flex-none"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Bulk Generate Mats</span>
              <span className="sm:hidden">Generate</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Station Table */}
      <StationTable
        stations={stations}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        onGenerateMat={handleOpenGenerateMat}
        isLoading={isLoading}
      />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingStation ? 'Edit Station' : 'Create Station'}
        size="lg"
      >
        <StationForm
          station={editingStation}
          onSubmit={handleSubmitForm}
          onCancel={handleCloseForm}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={handleCloseDelete}
        title="Delete Station"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm.stationName}</strong>?
            This will also remove all associated detection rules.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={handleCloseDelete} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
            >
              Delete Station
            </Button>
          </div>
        </div>
      </Modal>

      {/* Generate Mat Modal */}
      <Modal
        isOpen={generateMat.isOpen}
        onClose={handleCloseGenerateMat}
        title="Generate QC Mat"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Generate a printable QC mat for <strong>{generateMat.stationName}</strong>
          </p>
          <Select
            label="Layout"
            value={generateMat.layout}
            onChange={(e) =>
              setGenerateMat((prev) => ({
                ...prev,
                layout: e.target.value as MatLayout,
              }))
            }
            options={layoutOptions}
            disabled={generateMat.isGenerating}
          />
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              variant="ghost"
              onClick={handleCloseGenerateMat}
              disabled={generateMat.isGenerating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateMat}
              isLoading={generateMat.isGenerating}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generate PDF
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
