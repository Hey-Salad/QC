/**
 * HeySalad QC - PDF Mat Generator
 * 
 * Generates printable A4 QR code mats for QC stations.
 * Requirements: 2.1, 2.2, 2.3, 2.6
 */

import { jsPDF } from 'jspdf';
import type { Station, MatLayout } from '../types';
import { generateStationUrl } from './qrcode';
import QRCode from 'qrcode';

/** A4 dimensions in mm */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** QR code size in mm (50mm x 50mm as per requirements) */
const QR_SIZE_MM = 50;

/** Margins and spacing in mm */
const MARGIN_MM = 15;
const HEADER_HEIGHT_MM = 25;
const FOOTER_HEIGHT_MM = 15;

/** Detection zone border style */
const BORDER_DASH_PATTERN = [3, 3]; // 3mm dash, 3mm gap
const BORDER_WIDTH_MM = 0.5;

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

/**
 * Generates a QR code as a base64 data URL for embedding in PDF.
 * Uses optimized settings for good print quality with smaller file size.
 */
async function generateQRCodeForPDF(stationId: string): Promise<string> {
  const url = generateStationUrl(stationId);
  return QRCode.toDataURL(url, {
    type: 'image/png',
    width: 200, // Good resolution for print (50mm at ~100 DPI)
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Loads an image from URL and converts to optimized base64 data URL
 * Resizes large images to reduce PDF file size
 * Preserves transparency by using PNG format with white background fill
 */
async function loadImageAsDataUrl(url: string, maxWidth = 400, preserveTransparency = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate dimensions to fit within maxWidth while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Fill with white background for images with transparency (like logos)
      if (!preserveTransparency) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      // Use PNG for images that need transparency handling, JPEG otherwise
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/** Cached logo data URL */
let cachedLogoDataUrl: string | null = null;

/**
 * Renders text to a canvas and returns as data URL.
 * This allows using system fonts including Chinese characters.
 */
function renderTextAsImage(
  text: string, 
  fontSize: number, 
  color: string,
  fontFamily = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // Set font to measure text
  ctx.font = `${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  
  // Set canvas size with padding
  const padding = 4;
  canvas.width = Math.ceil(metrics.width) + padding * 2;
  canvas.height = fontSize + padding * 2;
  
  // Clear and draw text
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, padding, padding);
  
  return canvas.toDataURL('image/png');
}

/**
 * Gets the HeySalad logo as a data URL, loading from public folder
 */
async function getLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) {
    return cachedLogoDataUrl;
  }
  try {
    cachedLogoDataUrl = await loadImageAsDataUrl('/HeySalad Logo Black.png');
    return cachedLogoDataUrl;
  } catch {
    // Fallback to text if image fails to load
    return '';
  }
}

/**
 * Draws a dashed detection boundary rectangle.
 */
function drawDetectionZone(
  doc: jsPDF, 
  x: number, 
  y: number, 
  width: number, 
  height: number
): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BORDER_WIDTH_MM);
  doc.setLineDashPattern(BORDER_DASH_PATTERN, 0);
  doc.rect(x, y, width, height);
  doc.setLineDashPattern([], 0); // Reset dash pattern
}

/**
 * Draws a single detection zone with logo, QR code and labels.
 */
async function drawZoneContent(
  doc: jsPDF,
  station: Station,
  qrDataUrl: string,
  logoDataUrl: string,
  zoneX: number,
  zoneY: number,
  zoneWidth: number,
  zoneHeight: number
): Promise<void> {
  // Draw dashed detection boundary
  drawDetectionZone(doc, zoneX, zoneY, zoneWidth, zoneHeight);
  
  // Draw HeySalad logo at top of zone (centered)
  // Logo dimensions maintaining aspect ratio (3861:1317 ≈ 2.93:1)
  // Determine if this is a compact layout (2x2) - need smaller elements
  const isCompact = zoneHeight < 120;
  
  // Logo dimensions - scale based on zone size
  const logoWidth = isCompact ? 28 : 35; // mm
  const logoHeight = logoWidth / 2.93; // maintain aspect ratio
  const logoX = zoneX + (zoneWidth - logoWidth) / 2;
  const logoY = zoneY + 4;
  
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch {
      // Fallback to text if image fails
      doc.setFontSize(isCompact ? 11 : 14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(229, 57, 53);
      doc.text('HeySalad', zoneX + (zoneWidth - 25) / 2, logoY + 8);
    }
  }
  
  // QR code - scale for compact layout
  const qrSize = isCompact ? 35 : QR_SIZE_MM;
  const qrX = zoneX + (zoneWidth - qrSize) / 2;
  const qrY = logoY + logoHeight + 3;
  
  // Add QR code image
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  
  // Add station name below QR code
  const textY = qrY + qrSize + 5;
  doc.setFontSize(isCompact ? 10 : 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  
  // Center the station name
  const stationNameWidth = doc.getTextWidth(station.name);
  const nameX = zoneX + (zoneWidth - stationNameWidth) / 2;
  doc.text(station.name, nameX, textY);
  
  // Add English instruction label
  doc.setFontSize(isCompact ? 7 : 9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
  const labelEn = 'Scan QR code for quality check';
  const labelEnWidth = doc.getTextWidth(labelEn);
  doc.text(labelEn, zoneX + (zoneWidth - labelEnWidth) / 2, textY + 5);
  
  // Add Chinese instruction as image (to support Chinese characters)
  const labelZh = '扫描二维码进行质检';
  const zhFontSize = isCompact ? 12 : 16;
  const zhImageDataUrl = renderTextAsImage(labelZh, zhFontSize, '#666666');
  if (zhImageDataUrl) {
    const zhWidth = isCompact ? 24 : 32; // mm width in PDF
    const zhHeight = isCompact ? 4 : 5; // mm height in PDF
    const zhX = zoneX + (zoneWidth - zhWidth) / 2;
    doc.addImage(zhImageDataUrl, 'PNG', zhX, textY + 7, zhWidth, zhHeight);
  }
  
  // Add "Place items here" instruction at bottom of zone
  const instructionY = zoneY + zoneHeight - (isCompact ? 10 : 12);
  doc.setFontSize(isCompact ? 8 : 10);
  doc.setTextColor(150, 150, 150);
  
  const instructionEn = 'Place items in detection zone';
  const instrEnWidth = doc.getTextWidth(instructionEn);
  doc.text(instructionEn, zoneX + (zoneWidth - instrEnWidth) / 2, instructionY);
  
  // Add Chinese instruction for placement
  const instrZh = '将物品放置在检测区域内';
  const instrZhFontSize = isCompact ? 12 : 16;
  const instrZhImageDataUrl = renderTextAsImage(instrZh, instrZhFontSize, '#999999');
  if (instrZhImageDataUrl) {
    const instrZhWidth = isCompact ? 32 : 42; // mm width in PDF
    const instrZhHeight = isCompact ? 4 : 5; // mm height in PDF
    const instrZhX = zoneX + (zoneWidth - instrZhWidth) / 2;
    doc.addImage(instrZhImageDataUrl, 'PNG', instrZhX, instructionY + 4, instrZhWidth, instrZhHeight);
  }
}

/**
 * Generates a PDF mat for a station with the specified layout.
 * 
 * @param station - The station to generate the mat for
 * @param layout - The layout option (1x1, 2x1, or 2x2)
 * @returns Promise resolving to PDF as ArrayBuffer
 */
export async function generateMatPDF(
  station: Station,
  layout: MatLayout
): Promise<ArrayBuffer> {
  // Create PDF document (A4 size, portrait orientation)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // Generate QR code data URL and load logo
  const qrDataUrl = await generateQRCodeForPDF(station.id);
  const logoDataUrl = await getLogoDataUrl();
  
  // Get layout configuration
  const config = LAYOUT_CONFIGS[layout];
  
  // Draw simple header (logo is now inside each zone)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const typeText = `Station Type: ${station.type.charAt(0).toUpperCase() + station.type.slice(1)}`;
  doc.text(typeText, A4_WIDTH_MM - MARGIN_MM - doc.getTextWidth(typeText), MARGIN_MM + 5);
  
  // Calculate starting position for zones (reduced header since logo is in zones)
  const contentStartY = MARGIN_MM + 10;
  
  // Draw detection zones based on layout
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const zoneX = MARGIN_MM + col * (config.zoneWidth + MARGIN_MM);
      const zoneY = contentStartY + row * (config.zoneHeight + MARGIN_MM);
      
      await drawZoneContent(
        doc,
        station,
        qrDataUrl,
        logoDataUrl,
        zoneX,
        zoneY,
        config.zoneWidth,
        config.zoneHeight
      );
    }
  }
  
  // Draw footer with logo, URL, and metadata
  const footerY = A4_HEIGHT_MM - MARGIN_MM - 2;
  
  // Left: HeySalad logo (small)
  const footerLogoWidth = 20; // mm
  const footerLogoHeight = footerLogoWidth / 2.93; // maintain aspect ratio
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', MARGIN_MM, footerY - footerLogoHeight + 2, footerLogoWidth, footerLogoHeight);
    } catch {
      // Fallback to text if image fails
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(229, 57, 53);
      doc.text('HeySalad', MARGIN_MM, footerY);
    }
  }
  
  // Center: URL
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  const urlText = `qc.heysalad.app/station/${station.id}`;
  const urlWidth = doc.getTextWidth(urlText);
  doc.text(urlText, (A4_WIDTH_MM - urlWidth) / 2, footerY);
  
  // Right: Generated date and Station ID (stacked)
  const generatedText = `Generated: ${new Date().toISOString().split('T')[0]}`;
  const stationIdText = `ID: ${station.id.slice(0, 8)}...`;
  doc.text(stationIdText, A4_WIDTH_MM - MARGIN_MM - doc.getTextWidth(stationIdText), footerY - 3);
  doc.text(generatedText, A4_WIDTH_MM - MARGIN_MM - doc.getTextWidth(generatedText), footerY + 1);
  
  // Return PDF as ArrayBuffer
  return doc.output('arraybuffer');
}

/**
 * Generates a filename for the mat PDF.
 */
export function generateMatFilename(station: Station, layout: MatLayout): string {
  const sanitizedName = station.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const date = new Date().toISOString().split('T')[0];
  return `heysalad-qc-mat-${sanitizedName}-${layout}-${date}.pdf`;
}

/**
 * Validates mat generation request parameters.
 */
export function validateMatRequest(
  stationId: unknown,
  layout: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof stationId !== 'string' || stationId.trim().length === 0) {
    errors.push('station_id is required and must be a non-empty string');
  }
  
  if (!['1x1', '2x1', '2x2'].includes(layout as string)) {
    errors.push('layout must be one of: 1x1, 2x1, 2x2');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
