/**
 * HeySalad QC - Cloudflare Worker Entry Point
 * 
 * This worker handles API requests for the HeySalad QC application.
 * It connects to D1 database for data storage and R2 for PDF file storage.
 */

import type { Env, DetectionRequest } from './types';
import { StationRepository } from './lib/station-repository';
import { DetectionLogRepository } from './lib/detection-log-repository';
import { DetectionRulesRepository } from './lib/detection-rules-repository';
import { validateCreateStationInput, validateUpdateStationInput, validateDetectionRulesInput, isValidUUID, validateDetectionRequest } from './lib/validation';
import { processMockDetection } from './lib/mock-detection';
import { handleVisionRoutes } from './lib/vision-api';

// CORS headers helper
function corsHeaders(origin: string, allowedOrigins: string): HeadersInit {
  const origins = allowedOrigins.split(',').map(o => o.trim());
  const allowOrigin = origins.includes(origin) ? origin : origins[0];
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  };
}

// Handle CORS preflight requests
function handleOptions(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, env.ALLOWED_ORIGINS),
  });
}

// JSON response helper
function jsonResponse(data: unknown, status = 200, origin = '', allowedOrigins = ''): Response {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(allowedOrigins ? corsHeaders(origin, allowedOrigins) : {}),
  };
  
  return new Response(JSON.stringify(data), { status, headers });
}

// Error response helper
function errorResponse(message: string, status = 500, origin = '', allowedOrigins = ''): Response {
  return jsonResponse({ error: message }, status, origin, allowedOrigins);
}

// Validation error response helper
function validationErrorResponse(errors: string[], origin = '', allowedOrigins = ''): Response {
  return jsonResponse({ error: 'VALIDATION_ERROR', message: 'Validation failed', errors }, 422, origin, allowedOrigins);
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }
    
    // Initialize repository
    const stationRepository = new StationRepository(env.DB);
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      try {
        // Handle vision API routes first
        if (url.pathname.startsWith('/api/vision/')) {
          const visionResponse = await handleVisionRoutes(request, env, url);
          if (visionResponse) {
            return visionResponse;
          }
        }
        
        // Health check endpoint
        if (url.pathname === '/api/health') {
          return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, origin, env.ALLOWED_ORIGINS);
        }
        
        // GET /api/stations - List all stations (Requirements 5.1)
        if (url.pathname === '/api/stations' && request.method === 'GET') {
          const stations = await stationRepository.list();
          return jsonResponse(stations, 200, origin, env.ALLOWED_ORIGINS);
        }
        
        // POST /api/stations - Create station (Requirements 5.2)
        if (url.pathname === '/api/stations' && request.method === 'POST') {
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return errorResponse('Invalid JSON', 400, origin, env.ALLOWED_ORIGINS);
          }
          
          const validation = validateCreateStationInput(body);
          if (!validation.valid) {
            return validationErrorResponse(validation.errors, origin, env.ALLOWED_ORIGINS);
          }
          
          const station = await stationRepository.create(body as { name: string; type: 'packing' | 'prep' | 'storage' | 'receiving'; location?: string; description?: string });
          return jsonResponse(station, 201, origin, env.ALLOWED_ORIGINS);
        }
        
        // Station by ID endpoints
        const stationMatch = url.pathname.match(/^\/api\/stations\/([^/]+)$/);
        if (stationMatch) {
          const stationId = stationMatch[1];
          
          // Validate UUID format
          if (!isValidUUID(stationId)) {
            return errorResponse('Invalid station ID format', 400, origin, env.ALLOWED_ORIGINS);
          }
          
          // GET /api/stations/{id} - Get station by ID (Requirements 5.1)
          if (request.method === 'GET') {
            const station = await stationRepository.getById(stationId);
            if (!station) {
              return errorResponse('Station not found', 404, origin, env.ALLOWED_ORIGINS);
            }
            return jsonResponse(station, 200, origin, env.ALLOWED_ORIGINS);
          }
          
          // PUT /api/stations/{id} - Update station (Requirements 5.3)
          if (request.method === 'PUT') {
            let body: unknown;
            try {
              body = await request.json();
            } catch {
              return errorResponse('Invalid JSON', 400, origin, env.ALLOWED_ORIGINS);
            }
            
            const validation = validateUpdateStationInput(body);
            if (!validation.valid) {
              return validationErrorResponse(validation.errors, origin, env.ALLOWED_ORIGINS);
            }
            
            const station = await stationRepository.update(stationId, body as { name?: string; type?: 'packing' | 'prep' | 'storage' | 'receiving'; location?: string; description?: string });
            if (!station) {
              return errorResponse('Station not found', 404, origin, env.ALLOWED_ORIGINS);
            }
            return jsonResponse(station, 200, origin, env.ALLOWED_ORIGINS);
          }
          
          // DELETE /api/stations/{id} - Delete station (Requirements 5.4)
          if (request.method === 'DELETE') {
            const deleted = await stationRepository.delete(stationId);
            if (!deleted) {
              return errorResponse('Station not found', 404, origin, env.ALLOWED_ORIGINS);
            }
            return new Response(null, { 
              status: 204, 
              headers: corsHeaders(origin, env.ALLOWED_ORIGINS) 
            });
          }
        }
        
        // GET /api/stations/{id}/logs - Get detection logs for station (Requirements 5.7)
        const logsMatch = url.pathname.match(/^\/api\/stations\/([^/]+)\/logs$/);
        if (logsMatch && request.method === 'GET') {
          const stationId = logsMatch[1];
          
          // Validate UUID format
          if (!isValidUUID(stationId)) {
            return errorResponse('Invalid station ID format', 400, origin, env.ALLOWED_ORIGINS);
          }
          
          // Verify station exists
          const station = await stationRepository.getById(stationId);
          if (!station) {
            return errorResponse('Station not found', 404, origin, env.ALLOWED_ORIGINS);
          }
          
          // Get limit from query params (default 20)
          const limitParam = url.searchParams.get('limit');
          let limit = 20;
          if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
              limit = Math.min(parsedLimit, 100); // Cap at 100 for safety
            }
          }
          
          // Get detection logs
          const detectionLogRepository = new DetectionLogRepository(env.DB);
          const logs = await detectionLogRepository.getByStationId(stationId, limit);
          
          return jsonResponse(logs, 200, origin, env.ALLOWED_ORIGINS);
        }
        
        // /api/stations/{id}/rules - Detection rules endpoints (Requirements 5.8)
        const rulesMatch = url.pathname.match(/^\/api\/stations\/([^/]+)\/rules$/);
        if (rulesMatch) {
          const stationId = rulesMatch[1];
          
          // Validate UUID format
          if (!isValidUUID(stationId)) {
            return errorResponse('Invalid station ID format', 400, origin, env.ALLOWED_ORIGINS);
          }
          
          // Verify station exists
          const station = await stationRepository.getById(stationId);
          if (!station) {
            return errorResponse('Station not found', 404, origin, env.ALLOWED_ORIGINS);
          }
          
          const detectionRulesRepository = new DetectionRulesRepository(env.DB);
          
          // GET /api/stations/{id}/rules - Get detection rules for station
          if (request.method === 'GET') {
            const rules = await detectionRulesRepository.getByStationId(stationId);
            return jsonResponse(rules, 200, origin, env.ALLOWED_ORIGINS);
          }
          
          // PUT /api/stations/{id}/rules - Update detection rules for station
          if (request.method === 'PUT') {
            let body: unknown;
            try {
              body = await request.json();
            } catch {
              return errorResponse('Invalid JSON', 400, origin, env.ALLOWED_ORIGINS);
            }
            
            const validation = validateDetectionRulesInput(body);
            if (!validation.valid) {
              return validationErrorResponse(validation.errors, origin, env.ALLOWED_ORIGINS);
            }
            
            const rules = await detectionRulesRepository.upsert(
              stationId, 
              body as { expected_items: Array<{ label: string; required: boolean; min_confidence?: number }>; confidence_threshold?: number; alert_config?: { enabled: boolean; email?: string; slack_webhook?: string; sms?: string; triggers: Array<'missing_item' | 'low_confidence' | 'all_failures'> } }
            );
            return jsonResponse(rules, 200, origin, env.ALLOWED_ORIGINS);
          }
        }
        
        // Note: PDF generation moved to client-side for better compatibility
        // The /api/generate-mat endpoint is deprecated - use client-side mat-generator.ts instead
        
        // POST /api/detect - Process mock detection (Requirements 5.6)
        if (url.pathname === '/api/detect' && request.method === 'POST') {
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return errorResponse('Invalid JSON', 400, origin, env.ALLOWED_ORIGINS);
          }
          
          // Validate request body
          const validation = validateDetectionRequest(body);
          if (!validation.valid) {
            return validationErrorResponse(validation.errors, origin, env.ALLOWED_ORIGINS);
          }
          
          const { station_id: stationId } = body as DetectionRequest;
          
          // Validate station ID format
          if (!isValidUUID(stationId)) {
            return errorResponse('Invalid station ID format', 400, origin, env.ALLOWED_ORIGINS);
          }
          
          // Verify station exists
          const station = await stationRepository.getById(stationId);
          if (!station) {
            return errorResponse('Station not found', 404, origin, env.ALLOWED_ORIGINS);
          }
          
          // Get detection rules for the station
          const detectionRulesRepository = new DetectionRulesRepository(env.DB);
          const rules = await detectionRulesRepository.getByStationId(stationId);
          
          // Use default values if no rules configured
          const expectedItems = rules?.expected_items ?? [];
          const confidenceThreshold = rules?.confidence_threshold ?? 0.75;
          
          // Process mock detection
          const detectionResult = processMockDetection(expectedItems, confidenceThreshold);
          
          // Build confidence scores map from detected objects
          const confidenceScores: Record<string, number> = {};
          for (const obj of detectionResult.detected_objects) {
            confidenceScores[obj.label] = obj.confidence;
          }
          
          // Log the detection result
          const detectionLogRepository = new DetectionLogRepository(env.DB);
          await detectionLogRepository.create({
            station_id: stationId,
            detected_items: detectionResult.detected_objects,
            confidence_scores: confidenceScores,
            pass_fail: detectionResult.pass ? 'pass' : 'fail',
            image_url: null // Mock detection doesn't store images
          });
          
          return jsonResponse(detectionResult, 200, origin, env.ALLOWED_ORIGINS);
        }
        
        return errorResponse('Not Found', 404, origin, env.ALLOWED_ORIGINS);
      } catch (error) {
        console.error('API Error:', error);
        return errorResponse('Internal Server Error', 500, origin, env.ALLOWED_ORIGINS);
      }
    }
    
    // For non-API routes, return 404 (Pages will handle static files)
    return errorResponse('Not Found', 404, origin, env.ALLOWED_ORIGINS);
  },
};
