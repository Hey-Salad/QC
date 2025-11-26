/**
 * HeySalad QC - Cloud Vision API Routes
 * 
 * Implements the Cloud Vision API endpoints for camera management,
 * object detection, and health monitoring.
 * 
 * Requirements: 1.2, 2.1-2.4, 3.1-3.4, 4.1-4.2, 5.3, 7.1-7.2
 */

import type { Env, VisionDetectResponse, CreateCameraMappingInput, UpdateCameraMappingInput } from '../types';
import { CameraMappingRepository } from './camera-mapping-repository';
import { VisionDetectionRepository } from './vision-detection-repository';
import { CameraHealthRepository } from './camera-health-repository';
import { visionAuthMiddleware } from './vision-auth';
import { validateImage, resizeImageForWorkersAI, generateThumbnail } from './image-utils';
import { detectObjects } from './workers-ai-client';
import { generateUUID } from './station-repository';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * CORS headers helper
 */
function corsHeaders(origin: string, allowedOrigins: string): HeadersInit {
  const origins = allowedOrigins.split(',').map(o => o.trim());
  const allowOrigin = origins.includes(origin) ? origin : origins[0];
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  };
}

/**
 * JSON response helper
 */
function jsonResponse(data: unknown, status = 200, origin = '', allowedOrigins = ''): Response {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(allowedOrigins ? corsHeaders(origin, allowedOrigins) : {}),
  };
  
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Error response helper
 */
function errorResponse(message: string, status = 500, origin = '', allowedOrigins = ''): Response {
  return jsonResponse({ error: message }, status, origin, allowedOrigins);
}

// =============================================================================
// Vision API Route Handler
// =============================================================================

/**
 * Handles all /api/vision/* routes
 * Returns null if the route is not handled
 */
export async function handleVisionRoutes(
  request: Request,
  env: Env,
  url: URL
): Promise<Response | null> {
  const origin = request.headers.get('Origin') || '';
  const pathname = url.pathname;
  
  // Only handle /api/vision/* routes
  if (!pathname.startsWith('/api/vision/')) {
    return null;
  }

  // Health endpoint does NOT require authentication (per Requirements 7.1, 7.2)
  if (pathname === '/api/vision/health' && request.method === 'GET') {
    return handleHealthEndpoint(env, origin);
  }

  // All other vision routes require authentication
  const authResponse = visionAuthMiddleware(request, env);
  if (authResponse) {
    return authResponse;
  }

  // POST /api/vision/detect - Submit frame for detection
  if (pathname === '/api/vision/detect' && request.method === 'POST') {
    return handleDetectEndpoint(request, env, origin);
  }

  // GET /api/vision/cameras - List all cameras
  if (pathname === '/api/vision/cameras' && request.method === 'GET') {
    return handleListCameras(env, origin);
  }

  // POST /api/vision/cameras - Register new camera
  if (pathname === '/api/vision/cameras' && request.method === 'POST') {
    return handleCreateCamera(request, env, origin);
  }

  // Camera by ID routes
  const cameraMatch = pathname.match(/^\/api\/vision\/cameras\/([^/]+)$/);
  if (cameraMatch) {
    const cameraId = cameraMatch[1];
    
    // PUT /api/vision/cameras/:id - Update camera
    if (request.method === 'PUT') {
      return handleUpdateCamera(request, env, origin, cameraId);
    }
    
    // DELETE /api/vision/cameras/:id - Delete camera
    if (request.method === 'DELETE') {
      return handleDeleteCamera(env, origin, cameraId);
    }
  }

  // GET /api/vision/latest/:station_id - Get latest detection for station
  const latestMatch = pathname.match(/^\/api\/vision\/latest\/([^/]+)$/);
  if (latestMatch && request.method === 'GET') {
    const stationId = latestMatch[1];
    return handleLatestDetection(env, origin, stationId);
  }

  return null;
}


// =============================================================================
// POST /api/vision/detect - Submit frame for detection
// Requirements: 1.2, 3.1, 3.2, 3.3, 3.4, 4.1
// =============================================================================

async function handleDetectEndpoint(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const frameFile = formData.get('frame');
    const cameraId = formData.get('camera_id');
    
    // Validate camera_id
    if (!cameraId || typeof cameraId !== 'string') {
      return errorResponse('Missing camera_id', 400, origin, env.ALLOWED_ORIGINS);
    }
    
    // Validate frame file
    if (!frameFile || !(frameFile instanceof File)) {
      return errorResponse('Missing frame file', 400, origin, env.ALLOWED_ORIGINS);
    }
    
    // Get camera mapping to find station_id
    const cameraMappingRepo = new CameraMappingRepository(env.DB);
    const cameraMapping = await cameraMappingRepo.getById(cameraId);
    
    if (!cameraMapping) {
      return errorResponse('Camera not registered', 404, origin, env.ALLOWED_ORIGINS);
    }
    
    // Read frame data
    const frameBuffer = await frameFile.arrayBuffer();
    const frameData = new Uint8Array(frameBuffer);
    
    // Validate image format and size (Requirements 3.1, 3.2)
    const validation = validateImage(frameData);
    
    if (!validation.valid) {
      const errorMsg = validation.errors[0] || 'Invalid image';
      const status = errorMsg.includes('exceeds') ? 413 : 400;
      return errorResponse(errorMsg, status, origin, env.ALLOWED_ORIGINS);
    }
    
    // Get image dimensions
    let dimensions = validation.dimensions;
    if (!dimensions) {
      return errorResponse('Unable to extract image dimensions', 400, origin, env.ALLOWED_ORIGINS);
    }
    
    // Resize if needed (Requirement 3.3)
    let processedData: Uint8Array<ArrayBuffer> = frameData;
    if (validation.needsResize) {
      const resizeResult = await resizeImageForWorkersAI(frameData);
      if (resizeResult.success && resizeResult.data) {
        processedData = new Uint8Array(resizeResult.data);
        if (resizeResult.dimensions) {
          dimensions = resizeResult.dimensions;
        }
      }
    }
    
    // Run object detection via Workers AI (Requirement 1.2)
    if (!env.AI) {
      return errorResponse('AI service unavailable', 502, origin, env.ALLOWED_ORIGINS);
    }
    
    const detectedObjects = await detectObjects(
      env.AI,
      processedData.buffer as ArrayBuffer,
      dimensions.width,
      dimensions.height
    );
    
    // Generate thumbnail (Requirement 4.1)
    const thumbnailResult = await generateThumbnail(frameData);
    let thumbnailKey: string | null = null;
    
    if (thumbnailResult.success && thumbnailResult.data && env.VISION_THUMBNAILS) {
      const detectionId = generateUUID();
      thumbnailKey = `thumbnails/${cameraMapping.station_id}/${detectionId}.jpg`;
      
      // Use Uint8Array directly - R2 accepts ArrayBufferView
      await env.VISION_THUMBNAILS.put(thumbnailKey, thumbnailResult.data as ArrayBufferView, {
        httpMetadata: { contentType: 'image/jpeg' }
      });
    }
    
    // Calculate processing time
    const processingTimeMs = Date.now() - startTime;
    
    // Store detection result
    const detectionRepo = new VisionDetectionRepository(env.DB);
    const detection = await detectionRepo.create({
      camera_id: cameraId,
      station_id: cameraMapping.station_id,
      objects: detectedObjects,
      thumbnail_key: thumbnailKey ?? undefined,
      processing_time_ms: processingTimeMs
    });
    
    // Update camera health
    const healthRepo = new CameraHealthRepository(env.DB);
    await healthRepo.updateLastFrame(cameraId);
    
    // Log detection (Requirement 5.1)
    console.log(`Detection processed: camera=${cameraId}, station=${cameraMapping.station_id}, objects=${detectedObjects.length}, time=${processingTimeMs}ms`);
    
    // Build response
    const response: VisionDetectResponse = {
      success: true,
      detection_id: detection.id,
      station_id: detection.station_id,
      timestamp: detection.timestamp,
      objects: detectedObjects,
      thumbnail_url: thumbnailKey ? `/api/vision/thumbnails/${thumbnailKey}` : '',
      processing_time_ms: processingTimeMs
    };
    
    return jsonResponse(response, 200, origin, env.ALLOWED_ORIGINS);
    
  } catch (error) {
    console.error('Detection error:', error);
    return errorResponse('Internal server error', 500, origin, env.ALLOWED_ORIGINS);
  }
}


// =============================================================================
// Camera Management Endpoints
// Requirements: 2.1, 2.2, 2.3, 2.4
// =============================================================================

/**
 * GET /api/vision/cameras - List all cameras
 */
async function handleListCameras(env: Env, origin: string): Promise<Response> {
  try {
    const repo = new CameraMappingRepository(env.DB);
    const cameras = await repo.list();
    return jsonResponse(cameras, 200, origin, env.ALLOWED_ORIGINS);
  } catch (error) {
    console.error('List cameras error:', error);
    return errorResponse('Internal server error', 500, origin, env.ALLOWED_ORIGINS);
  }
}

/**
 * POST /api/vision/cameras - Register new camera
 * Requirement 2.1
 */
async function handleCreateCamera(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON', 400, origin, env.ALLOWED_ORIGINS);
    }
    
    // Validate required fields
    const input = body as Record<string, unknown>;
    if (!input.camera_id || typeof input.camera_id !== 'string') {
      return errorResponse('camera_id is required', 400, origin, env.ALLOWED_ORIGINS);
    }
    if (!input.station_id || typeof input.station_id !== 'string') {
      return errorResponse('station_id is required', 400, origin, env.ALLOWED_ORIGINS);
    }
    if (!input.rtsp_url || typeof input.rtsp_url !== 'string') {
      return errorResponse('rtsp_url is required', 400, origin, env.ALLOWED_ORIGINS);
    }
    
    const createInput: CreateCameraMappingInput = {
      camera_id: input.camera_id,
      station_id: input.station_id,
      rtsp_url: input.rtsp_url,
      name: typeof input.name === 'string' ? input.name : undefined
    };
    
    const repo = new CameraMappingRepository(env.DB);
    
    // Check if camera already exists
    const existing = await repo.getById(createInput.camera_id);
    if (existing) {
      return errorResponse('Camera already registered', 409, origin, env.ALLOWED_ORIGINS);
    }
    
    const camera = await repo.create(createInput);
    return jsonResponse(camera, 201, origin, env.ALLOWED_ORIGINS);
    
  } catch (error) {
    console.error('Create camera error:', error);
    return errorResponse('Internal server error', 500, origin, env.ALLOWED_ORIGINS);
  }
}

/**
 * PUT /api/vision/cameras/:id - Update camera
 * Requirement 2.3
 */
async function handleUpdateCamera(
  request: Request,
  env: Env,
  origin: string,
  cameraId: string
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON', 400, origin, env.ALLOWED_ORIGINS);
    }
    
    const input = body as Record<string, unknown>;
    const updateInput: UpdateCameraMappingInput = {};
    
    if (typeof input.station_id === 'string') {
      updateInput.station_id = input.station_id;
    }
    if (typeof input.rtsp_url === 'string') {
      updateInput.rtsp_url = input.rtsp_url;
    }
    if (typeof input.name === 'string' || input.name === null) {
      updateInput.name = input.name ?? undefined;
    }
    
    const repo = new CameraMappingRepository(env.DB);
    const camera = await repo.update(cameraId, updateInput);
    
    if (!camera) {
      return errorResponse('Camera not found', 404, origin, env.ALLOWED_ORIGINS);
    }
    
    return jsonResponse(camera, 200, origin, env.ALLOWED_ORIGINS);
    
  } catch (error) {
    console.error('Update camera error:', error);
    return errorResponse('Internal server error', 500, origin, env.ALLOWED_ORIGINS);
  }
}

/**
 * DELETE /api/vision/cameras/:id - Delete camera
 * Requirement 2.4
 */
async function handleDeleteCamera(
  env: Env,
  origin: string,
  cameraId: string
): Promise<Response> {
  try {
    const repo = new CameraMappingRepository(env.DB);
    const deleted = await repo.delete(cameraId);
    
    if (!deleted) {
      return errorResponse('Camera not found', 404, origin, env.ALLOWED_ORIGINS);
    }
    
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin, env.ALLOWED_ORIGINS)
    });
    
  } catch (error) {
    console.error('Delete camera error:', error);
    return errorResponse('Internal server error', 500, origin, env.ALLOWED_ORIGINS);
  }
}


// =============================================================================
// GET /api/vision/health - System health status
// Requirement 5.3
// =============================================================================

async function handleHealthEndpoint(env: Env, origin: string): Promise<Response> {
  try {
    const healthRepo = new CameraHealthRepository(env.DB);
    const cameraMappingRepo = new CameraMappingRepository(env.DB);
    
    // Get all camera health records
    const healthRecords = await healthRepo.getAllHealth();
    
    // Get all camera mappings to include names
    const cameras = await cameraMappingRepo.list();
    const cameraNameMap = new Map(cameras.map(c => [c.camera_id, c.name]));
    
    // Combine health with camera names
    const camerasWithNames = healthRecords.map(health => ({
      ...health,
      camera_name: cameraNameMap.get(health.camera_id) ?? null
    }));
    
    return jsonResponse({ cameras: camerasWithNames }, 200, origin, env.ALLOWED_ORIGINS);
    
  } catch (error) {
    console.error('Health endpoint error:', error);
    return errorResponse('Internal server error', 500, origin, env.ALLOWED_ORIGINS);
  }
}

// =============================================================================
// GET /api/vision/latest/:station_id - Get latest detection for station
// Requirement 4.2
// =============================================================================

async function handleLatestDetection(
  env: Env,
  origin: string,
  stationId: string
): Promise<Response> {
  try {
    const detectionRepo = new VisionDetectionRepository(env.DB);
    const cameraMappingRepo = new CameraMappingRepository(env.DB);
    
    // Get latest detection for station
    const detection = await detectionRepo.getLatestByStationId(stationId);
    
    if (!detection) {
      return errorResponse('No detections found for station', 404, origin, env.ALLOWED_ORIGINS);
    }
    
    // Get camera mapping
    const camera = await cameraMappingRepo.getById(detection.camera_id);
    
    if (!camera) {
      return errorResponse('Camera not found', 404, origin, env.ALLOWED_ORIGINS);
    }
    
    // Build thumbnail URL
    const thumbnailUrl = detection.thumbnail_key 
      ? `/api/vision/thumbnails/${detection.thumbnail_key}`
      : '';
    
    return jsonResponse({
      detection,
      thumbnail_url: thumbnailUrl,
      camera
    }, 200, origin, env.ALLOWED_ORIGINS);
    
  } catch (error) {
    console.error('Latest detection error:', error);
    return errorResponse('Internal server error', 500, origin, env.ALLOWED_ORIGINS);
  }
}
