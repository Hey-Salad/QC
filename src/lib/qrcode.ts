/**
 * HeySalad QC - QR Code Generation Utility
 * 
 * Generates QR codes for station URLs.
 * Requirements: 2.4
 */

import QRCode from 'qrcode';

/** Base URL for station QR codes */
export const QC_BASE_URL = 'https://qc.heysalad.app/station';

/**
 * Generates the station URL for a given station ID.
 * Format: https://qc.heysalad.app/station/{station_id}
 * 
 * @param stationId - The UUID of the station
 * @returns The full URL for the station
 */
export function generateStationUrl(stationId: string): string {
  return `${QC_BASE_URL}/${stationId}`;
}

/**
 * Generates a QR code as a data URL (base64 PNG).
 * 
 * @param stationId - The UUID of the station
 * @param options - Optional QR code generation options
 * @returns Promise resolving to a data URL string
 */
export async function generateQRCodeDataUrl(
  stationId: string,
  options?: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
): Promise<string> {
  const url = generateStationUrl(stationId);
  
  const qrOptions: QRCode.QRCodeToDataURLOptions = {
    type: 'image/png',
    width: options?.width ?? 200,
    margin: options?.margin ?? 2,
    errorCorrectionLevel: options?.errorCorrectionLevel ?? 'M',
  };
  
  return QRCode.toDataURL(url, qrOptions);
}

/**
 * Generates a QR code as a Buffer (PNG format).
 * Useful for server-side PDF generation.
 * 
 * @param stationId - The UUID of the station
 * @param options - Optional QR code generation options
 * @returns Promise resolving to a Buffer containing PNG data
 */
export async function generateQRCodeBuffer(
  stationId: string,
  options?: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
): Promise<Buffer> {
  const url = generateStationUrl(stationId);
  
  const qrOptions: QRCode.QRCodeToBufferOptions = {
    type: 'png',
    width: options?.width ?? 200,
    margin: options?.margin ?? 2,
    errorCorrectionLevel: options?.errorCorrectionLevel ?? 'M',
  };
  
  return QRCode.toBuffer(url, qrOptions);
}

/**
 * Decodes a QR code URL to extract the station ID.
 * Returns null if the URL doesn't match the expected format.
 * 
 * @param url - The URL encoded in the QR code
 * @returns The station ID or null if invalid format
 */
export function extractStationIdFromUrl(url: string): string | null {
  const prefix = `${QC_BASE_URL}/`;
  if (!url.startsWith(prefix)) {
    return null;
  }
  
  const stationId = url.slice(prefix.length);
  // Ensure there's no trailing path or query string
  if (stationId.includes('/') || stationId.includes('?') || stationId.includes('#')) {
    return null;
  }
  
  return stationId || null;
}
