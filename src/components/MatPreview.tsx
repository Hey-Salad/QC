/**
 * HeySalad QC - MatPreview Component
 * 
 * Live preview of A4 mat design with layout options.
 * Requirements: 2.1, 2.2
 */

import { useState, useEffect } from 'react';
import type { Station, MatLayout } from '../types';
import { generateQRCodeDataUrl } from '../lib/qrcode';

export interface MatPreviewProps {
  /** Station to preview mat for */
  station: Station;
  /** Layout option (1x1, 2x1, or 2x2) */
  layout: MatLayout;
  /** Scale factor for preview (default 0.5 = 50% of actual size) */
  scale?: number;
  /** Additional CSS classes */
  className?: string;
  /** Show QR code in preview */
  showQRCode?: boolean;
}

/** A4 dimensions in mm */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** Margins and spacing in mm */
const MARGIN_MM = 15;
const HEADER_HEIGHT_MM = 25;
const FOOTER_HEIGHT_MM = 15;

/** QR code size in mm */
const QR_SIZE_MM = 50;

/** Layout configurations */
interface LayoutConfig {
  rows: number;
  cols: number;
  zoneWidth: number;
  zoneHeight: number;
}

const LAYOUT_CONFIGS: Record<MatLayout, LayoutConfig> = {
  '1x1': {
    rows: 1,
    cols: 1,
    zoneWidth: A4_WIDTH_MM - (2 * MARGIN_MM),
    zoneHeight: A4_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - (2 * MARGIN_MM),
  },
  '2x1': {
    rows: 1,
    cols: 2,
    zoneWidth: (A4_WIDTH_MM - (3 * MARGIN_MM)) / 2,
    zoneHeight: A4_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - (2 * MARGIN_MM),
  },
  '2x2': {
    rows: 2,
    cols: 2,
    zoneWidth: (A4_WIDTH_MM - (3 * MARGIN_MM)) / 2,
    zoneHeight: (A4_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - (3 * MARGIN_MM)) / 2,
  },
};

/** Convert mm to pixels at given scale */
function mmToPx(mm: number, scale: number): number {
  // Assume 96 DPI for screen, 1 inch = 25.4mm
  const pxPerMm = 96 / 25.4;
  return mm * pxPerMm * scale;
}

export function MatPreview({
  station,
  layout,
  scale = 0.5,
  className = '',
  showQRCode = true,
}: MatPreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (showQRCode && station.id) {
      generateQRCodeDataUrl(station.id, { width: 200 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    }
  }, [station.id, showQRCode]);

  const config = LAYOUT_CONFIGS[layout];
  const contentStartY = MARGIN_MM + HEADER_HEIGHT_MM;

  // Calculate scaled dimensions
  const pageWidth = mmToPx(A4_WIDTH_MM, scale);
  const pageHeight = mmToPx(A4_HEIGHT_MM, scale);

  // Generate detection zones
  const zones: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      zones.push({
        x: mmToPx(MARGIN_MM + col * (config.zoneWidth + MARGIN_MM), scale),
        y: mmToPx(contentStartY + row * (config.zoneHeight + MARGIN_MM), scale),
        width: mmToPx(config.zoneWidth, scale),
        height: mmToPx(config.zoneHeight, scale),
      });
    }
  }

  const qrSize = mmToPx(QR_SIZE_MM, scale);

  return (
    <div
      className={`relative bg-white shadow-lg border border-gray-300 ${className}`}
      style={{
        width: pageWidth,
        height: pageHeight,
      }}
      role="img"
      aria-label={`Mat preview for ${station.name} with ${layout} layout`}
    >
      {/* Header */}
      <div
        className="absolute flex items-center justify-between"
        style={{
          left: mmToPx(MARGIN_MM, scale),
          top: mmToPx(MARGIN_MM, scale),
          right: mmToPx(MARGIN_MM, scale),
          height: mmToPx(HEADER_HEIGHT_MM - 10, scale),
        }}
      >
        {/* Logo */}
        <div className="flex items-baseline">
          <span
            className="font-bold"
            style={{
              fontSize: mmToPx(5, scale),
              color: '#DC3545', // Tomato red
            }}
          >
            HeySalad
          </span>
          <span
            className="ml-1"
            style={{
              fontSize: mmToPx(3, scale),
              color: '#28A745', // Fresh green
            }}
          >
            QC
          </span>
        </div>

        {/* Station type */}
        <span
          className="text-gray-500"
          style={{ fontSize: mmToPx(3, scale) }}
        >
          Station Type: {station.type.charAt(0).toUpperCase() + station.type.slice(1)}
        </span>
      </div>

      {/* Detection Zones */}
      {zones.map((zone, index) => (
        <div
          key={index}
          className="absolute border-2 border-dashed border-black flex flex-col items-center"
          style={{
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height,
          }}
        >
          {/* QR Code */}
          {showQRCode && qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="mt-2"
              style={{
                width: qrSize,
                height: qrSize,
              }}
            />
          )}

          {/* Station Name */}
          <span
            className="font-bold text-black mt-2"
            style={{ fontSize: mmToPx(4, scale) }}
          >
            {station.name}
          </span>

          {/* Bilingual Labels */}
          <span
            className="text-gray-500"
            style={{ fontSize: mmToPx(2.5, scale) }}
          >
            Scan for QC Check
          </span>
          <span
            className="text-gray-500"
            style={{ fontSize: mmToPx(2.5, scale) }}
          >
            扫描进行质检
          </span>

          {/* Bottom Instructions */}
          <div
            className="absolute bottom-2 text-center text-gray-400"
            style={{ fontSize: mmToPx(2.5, scale) }}
          >
            <div>Place items in detection zone</div>
            <div>将物品放置在检测区域内</div>
          </div>
        </div>
      ))}

      {/* Footer */}
      <div
        className="absolute flex items-center justify-between text-gray-400"
        style={{
          left: mmToPx(MARGIN_MM, scale),
          bottom: mmToPx(MARGIN_MM - 5, scale),
          right: mmToPx(MARGIN_MM, scale),
          fontSize: mmToPx(2.5, scale),
        }}
      >
        <span>
          Generated: {new Date().toISOString().split('T')[0]} | Station ID: {station.id}
        </span>
        <span>qc.heysalad.app/station/{station.id}</span>
      </div>
    </div>
  );
}
