/**
 * HeySalad QC - QRCodePreview Component
 * 
 * Renders a QR code preview for a station using the qrcode library.
 * Requirements: 1.2
 */

import { useState, useEffect } from 'react';
import { generateQRCodeDataUrl } from '../lib/qrcode';

export interface QRCodePreviewProps {
  /** Station ID to generate QR code for */
  stationId: string;
  /** Size of the QR code in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Alt text for the QR code image */
  alt?: string;
  /** Show loading state */
  showLoading?: boolean;
}

export function QRCodePreview({
  stationId,
  size = 128,
  className = '',
  alt,
  showLoading = true,
}: QRCodePreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generateQR() {
      if (!stationId) {
        setError('No station ID provided');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const url = await generateQRCodeDataUrl(stationId, {
          width: size,
          margin: 2,
          errorCorrectionLevel: 'M',
        });

        if (!cancelled) {
          setDataUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate QR code');
          setIsLoading(false);
        }
      }
    }

    generateQR();

    return () => {
      cancelled = true;
    };
  }, [stationId, size]);

  const altText = alt ?? `QR code for station ${stationId}`;

  if (isLoading && showLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width: size, height: size }}
        role="status"
        aria-label="Loading QR code"
      >
        <svg
          className="animate-spin h-6 w-6 text-gray-400"
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
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 border border-red-200 rounded text-red-600 text-xs text-center p-2 ${className}`}
        style={{ width: size, height: size }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!dataUrl) {
    return null;
  }

  return (
    <img
      src={dataUrl}
      alt={altText}
      width={size}
      height={size}
      className={`rounded ${className}`}
    />
  );
}
