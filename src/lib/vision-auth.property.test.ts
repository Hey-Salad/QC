/**
 * HeySalad QC - Property-Based Tests for Vision Authentication
 * 
 * Uses fast-check for property-based testing.
 * Configuration: 100 iterations per property as specified in design.
 * 
 * **Feature: cloud-vision-integration, Property 13: Authentication rejection**
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  extractApiKey,
  validateApiKey,
  authenticateRequest,
  visionAuthMiddleware,
} from './vision-auth';
import type { Env } from '../types';

const fcConfig = { numRuns: 100 };

/**
 * Arbitrary for generating realistic API keys (alphanumeric, no whitespace)
 * This avoids issues with HTTP header trimming of whitespace
 */
const apiKeyArb = fc.stringMatching(/^[a-zA-Z0-9]{8,64}$/);

/**
 * Creates a mock Request with optional X-API-Key header
 */
function createMockRequest(apiKey?: string | null): Request {
  const headers = new Headers();
  if (apiKey !== null && apiKey !== undefined) {
    headers.set('X-API-Key', apiKey);
  }
  return new Request('https://example.com/api/vision/detect', {
    method: 'POST',
    headers,
  });
}

/**
 * Creates a mock Env with optional VISION_API_KEY
 */
function createMockEnv(visionApiKey?: string): Env {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    ALLOWED_ORIGINS: 'https://example.com',
    VISION_API_KEY: visionApiKey,
  };
}

describe('Vision Authentication Property Tests', () => {
  /**
   * **Feature: cloud-vision-integration, Property 13: Authentication rejection**
   * 
   * *For any* request to the vision API without a valid API key, 
   * the response status SHALL be 401.
   * 
   * **Validates: Requirements 7.2**
   */
  describe('Property 13: Authentication rejection', () => {
    test('rejects requests with missing X-API-Key header', () => {
      fc.assert(
        fc.property(
          // Generate any valid API key that could be configured
          apiKeyArb,
          (configuredKey) => {
            const request = createMockRequest(); // No API key header
            const env = createMockEnv(configuredKey);
            
            const response = visionAuthMiddleware(request, env);
            
            expect(response).not.toBeNull();
            expect(response?.status).toBe(401);
          }
        ),
        fcConfig
      );
    });

    test('rejects requests with invalid API key', () => {
      fc.assert(
        fc.property(
          // Generate configured key and a different request key
          apiKeyArb,
          apiKeyArb,
          (configuredKey, requestKey) => {
            // Ensure the keys are different
            fc.pre(configuredKey !== requestKey);
            
            const request = createMockRequest(requestKey);
            const env = createMockEnv(configuredKey);
            
            const response = visionAuthMiddleware(request, env);
            
            expect(response).not.toBeNull();
            expect(response?.status).toBe(401);
          }
        ),
        fcConfig
      );
    });

    test('rejects requests when no API key is configured in environment', () => {
      fc.assert(
        fc.property(
          // Generate any API key that could be sent in request
          apiKeyArb,
          (requestKey) => {
            const request = createMockRequest(requestKey);
            const env = createMockEnv(); // No VISION_API_KEY configured
            
            const response = visionAuthMiddleware(request, env);
            
            expect(response).not.toBeNull();
            expect(response?.status).toBe(401);
          }
        ),
        fcConfig
      );
    });

    test('accepts requests with valid API key', () => {
      fc.assert(
        fc.property(
          // Generate valid API keys (alphanumeric, no whitespace issues)
          apiKeyArb,
          (apiKey) => {
            const request = createMockRequest(apiKey);
            const env = createMockEnv(apiKey); // Same key configured
            
            const response = visionAuthMiddleware(request, env);
            
            // null means authenticated (no error response)
            expect(response).toBeNull();
          }
        ),
        fcConfig
      );
    });

    test('returns 401 status for any non-matching key', () => {
      fc.assert(
        fc.property(
          // Generate configured key
          apiKeyArb,
          // Generate various invalid keys (empty, partial match, etc.)
          fc.oneof(
            fc.constant(''), // Empty string
            fc.stringMatching(/^[a-zA-Z0-9]{1,7}$/), // Too short
            fc.stringMatching(/^[a-zA-Z0-9]{65,80}$/), // Too long
          ),
          (configuredKey, invalidKey) => {
            const request = createMockRequest(invalidKey);
            const env = createMockEnv(configuredKey);
            
            const response = visionAuthMiddleware(request, env);
            
            expect(response).not.toBeNull();
            expect(response?.status).toBe(401);
          }
        ),
        fcConfig
      );
    });
  });

  describe('extractApiKey', () => {
    test('extracts API key from X-API-Key header', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          (apiKey) => {
            const request = createMockRequest(apiKey);
            expect(extractApiKey(request)).toBe(apiKey);
          }
        ),
        fcConfig
      );
    });

    test('returns null when header is missing', () => {
      const request = createMockRequest();
      expect(extractApiKey(request)).toBeNull();
    });
  });

  describe('validateApiKey', () => {
    test('returns false for null API key', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          (configuredKey) => {
            const env = createMockEnv(configuredKey);
            expect(validateApiKey(null, env)).toBe(false);
          }
        ),
        fcConfig
      );
    });

    test('returns false when no key is configured', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          (requestKey) => {
            const env = createMockEnv(); // No key configured
            expect(validateApiKey(requestKey, env)).toBe(false);
          }
        ),
        fcConfig
      );
    });

    test('returns true only when keys match exactly', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          (apiKey) => {
            const env = createMockEnv(apiKey);
            expect(validateApiKey(apiKey, env)).toBe(true);
          }
        ),
        fcConfig
      );
    });
  });

  describe('authenticateRequest', () => {
    test('returns authenticated: false with error for missing key', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          (configuredKey) => {
            const request = createMockRequest();
            const env = createMockEnv(configuredKey);
            
            const result = authenticateRequest(request, env);
            
            expect(result.authenticated).toBe(false);
            expect(result.error).toBe('Authentication required');
          }
        ),
        fcConfig
      );
    });

    test('returns authenticated: false with error for invalid key', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          apiKeyArb,
          (configuredKey, requestKey) => {
            fc.pre(configuredKey !== requestKey);
            
            const request = createMockRequest(requestKey);
            const env = createMockEnv(configuredKey);
            
            const result = authenticateRequest(request, env);
            
            expect(result.authenticated).toBe(false);
            expect(result.error).toBe('Invalid API key');
          }
        ),
        fcConfig
      );
    });

    test('returns authenticated: true for valid key', () => {
      fc.assert(
        fc.property(
          // Generate valid API keys (alphanumeric, no whitespace issues)
          apiKeyArb,
          (apiKey) => {
            const request = createMockRequest(apiKey);
            const env = createMockEnv(apiKey);
            
            const result = authenticateRequest(request, env);
            
            expect(result.authenticated).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        fcConfig
      );
    });
  });
});
