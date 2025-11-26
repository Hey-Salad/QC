/**
 * HeySalad QC - Vision API Authentication Middleware
 * 
 * Provides authentication for the Cloud Vision API endpoints.
 * Validates API keys from the X-API-Key header against stored keys.
 * 
 * Requirements: 7.1, 7.2
 */

import type { Env } from '../types';

/** Authentication result */
export interface AuthResult {
  authenticated: boolean;
  error?: string;
}

/** Authentication error response */
export interface AuthErrorResponse {
  error: string;
  status: 401;
}

/**
 * Extracts the API key from the X-API-Key header
 * 
 * @param request - The incoming request
 * @returns The API key or null if not present
 */
export function extractApiKey(request: Request): string | null {
  return request.headers.get('X-API-Key');
}

/**
 * Validates an API key against the stored key in environment variables
 * 
 * @param apiKey - The API key to validate
 * @param env - The Cloudflare Worker environment
 * @returns True if the API key is valid, false otherwise
 */
export function validateApiKey(apiKey: string | null, env: Env): boolean {
  // If no API key is configured, reject all requests
  if (!env.VISION_API_KEY) {
    return false;
  }
  
  // If no API key provided in request, reject
  if (!apiKey) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  return constantTimeCompare(apiKey, env.VISION_API_KEY);
}

/**
 * Performs constant-time string comparison to prevent timing attacks
 * 
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Authenticates a request using the X-API-Key header
 * 
 * @param request - The incoming request
 * @param env - The Cloudflare Worker environment
 * @returns AuthResult indicating success or failure
 */
export function authenticateRequest(request: Request, env: Env): AuthResult {
  const apiKey = extractApiKey(request);
  
  if (!apiKey) {
    return {
      authenticated: false,
      error: 'Authentication required'
    };
  }
  
  if (!validateApiKey(apiKey, env)) {
    return {
      authenticated: false,
      error: 'Invalid API key'
    };
  }
  
  return { authenticated: true };
}

/**
 * Creates a 401 Unauthorized response for authentication failures
 * 
 * @param message - The error message
 * @param origin - The request origin for CORS
 * @param allowedOrigins - Allowed origins for CORS
 * @returns A 401 Response
 */
export function createAuthErrorResponse(
  message: string,
  origin: string = '',
  allowedOrigins: string = ''
): Response {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (allowedOrigins) {
    const origins = allowedOrigins.split(',').map(o => o.trim());
    const allowOrigin = origins.includes(origin) ? origin : origins[0];
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key';
  }
  
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers }
  );
}

/**
 * Middleware function to authenticate vision API requests
 * Returns null if authenticated, or a 401 Response if not
 * 
 * @param request - The incoming request
 * @param env - The Cloudflare Worker environment
 * @returns null if authenticated, Response if not
 */
export function visionAuthMiddleware(
  request: Request,
  env: Env
): Response | null {
  const origin = request.headers.get('Origin') || '';
  const authResult = authenticateRequest(request, env);
  
  if (!authResult.authenticated) {
    return createAuthErrorResponse(
      authResult.error || 'Authentication required',
      origin,
      env.ALLOWED_ORIGINS
    );
  }
  
  return null;
}
