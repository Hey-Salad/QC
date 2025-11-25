/**
 * HeySalad QC - Configuration
 * 
 * Environment-aware configuration for API endpoints.
 */

// Production API URL - the Cloudflare Worker endpoint
const PROD_API_URL = 'https://heysalad-qc.heysalad-o.workers.dev/api';

// Check if running in development (localhost)
function isDevelopment(): boolean {
  if (typeof document !== 'undefined') {
    const hostname = document.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  }
  return false;
}

// API base URL - uses local proxy in dev, direct worker URL in production
export const API_BASE = isDevelopment() ? '/api' : PROD_API_URL;
