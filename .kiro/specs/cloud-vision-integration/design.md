# Design Document: Cloud Vision Integration

## Overview

This design describes a hybrid cloud vision system that offloads AI-powered object detection from Raspberry Pi devices to Cloudflare Workers AI. The architecture consists of three main components:

1. **RPi Client** - A lightweight Python script that captures frames from RTSP cameras periodically
2. **Cloud Vision API** - A Cloudflare Worker that receives frames, runs object detection via Workers AI, and stores results
3. **HeySalad QC Integration** - Updates to the existing web app to display real detection results

This approach reduces RPi CPU usage from ~80% (continuous video processing) to <15% (periodic frame capture), eliminating overheating issues while providing scalable cloud-based AI detection.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              QC Station                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  IP Camera   │────▶│  RPi Client  │────▶│   Internet   │                │
│  │   (RTSP)     │     │  (Python)    │     │              │                │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                │
└─────────────────────────────────────────────────────┼───────────────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Cloud Vision API (Worker)                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │   Auth     │  │  Validate  │  │  Resize    │  │  Transform │     │  │
│  │  │ Middleware │─▶│   Frame    │─▶│   Image    │─▶│   Result   │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  Workers AI  │     │     D1       │     │     R2       │                │
│  │  (Detection) │     │  (Metadata)  │     │ (Thumbnails) │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HeySalad QC Web App                                   │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  Detection   │     │   Camera     │     │  Checklist   │                │
│  │   Display    │◀───│    Feed      │     │   Update     │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. RPi Client (Python)

A minimal Python script that runs on Raspberry Pi to capture and send frames.

```python
# Pseudocode structure
class RPiVisionClient:
    def __init__(self, api_url: str, api_key: str, cameras: list[CameraConfig])
    def capture_frame(self, rtsp_url: str) -> bytes  # Single frame capture
    def send_frame(self, camera_id: str, frame: bytes) -> DetectionResult
    def run(self, interval_seconds: int = 2)  # Main loop
```

**Key Design Decisions:**
- Uses `ffmpeg` subprocess for frame capture (single frame, not continuous stream)
- Releases RTSP connection immediately after capture
- Sleeps between captures to minimize CPU usage
- Sends frames as multipart/form-data to reduce encoding overhead

### 2. Cloud Vision API (Cloudflare Worker)

Extends the existing HeySalad QC worker with vision endpoints.

**New Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/vision/detect` | Submit frame for detection |
| GET | `/api/vision/cameras` | List registered cameras |
| POST | `/api/vision/cameras` | Register camera-station mapping |
| PUT | `/api/vision/cameras/:id` | Update camera mapping |
| DELETE | `/api/vision/cameras/:id` | Delete camera mapping |
| GET | `/api/vision/health` | System health status |
| GET | `/api/vision/latest/:station_id` | Get latest detection for station |

**Request/Response Examples:**

```typescript
// POST /api/vision/detect
// Request: multipart/form-data with 'frame' file and 'camera_id' field
// Response:
interface DetectResponse {
  success: boolean;
  detection_id: string;
  station_id: string;
  timestamp: string;
  objects: DetectedObject[];
  thumbnail_url: string;
  processing_time_ms: number;
}

interface DetectedObject {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}
```

### 3. Workers AI Integration

Uses Cloudflare Workers AI for object detection.

**Model Selection:**
- Primary: `@cf/microsoft/resnet-50` for image classification
- Alternative: `@cf/facebook/detr-resnet-50` for object detection with bounding boxes

**Processing Pipeline:**
1. Receive frame (JPEG/PNG)
2. Validate format and size
3. Resize if > 1920x1080
4. Send to Workers AI
5. Filter results by confidence threshold (0.5)
6. Transform to HeySalad detection schema
7. Store result and thumbnail
8. Return response

### 4. Data Storage

**D1 Database - New Tables:**

```sql
-- Camera to station mappings
CREATE TABLE camera_mappings (
  camera_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  rtsp_url TEXT NOT NULL,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

-- Vision detection results
CREATE TABLE vision_detections (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  objects_json TEXT NOT NULL,
  thumbnail_key TEXT,
  processing_time_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (camera_id) REFERENCES camera_mappings(camera_id),
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

-- Camera health tracking
CREATE TABLE camera_health (
  camera_id TEXT PRIMARY KEY,
  last_frame_at TEXT,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  status TEXT DEFAULT 'unknown',
  FOREIGN KEY (camera_id) REFERENCES camera_mappings(camera_id)
);
```

**R2 Bucket:**
- Stores frame thumbnails
- Key format: `thumbnails/{station_id}/{detection_id}.jpg`
- Auto-cleanup after 7 days via lifecycle rules

## Data Models

```typescript
// Camera mapping
interface CameraMapping {
  camera_id: string;
  station_id: string;
  rtsp_url: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

// Detection result (stored)
interface VisionDetection {
  id: string;
  camera_id: string;
  station_id: string;
  timestamp: string;
  objects: DetectedObject[];
  thumbnail_key?: string;
  processing_time_ms: number;
}

// Detected object
interface DetectedObject {
  label: string;
  confidence: number;
  bbox: BoundingBox;
}

interface BoundingBox {
  x: number;      // 0-1 normalized
  y: number;      // 0-1 normalized
  width: number;  // 0-1 normalized
  height: number; // 0-1 normalized
}

// Camera health
interface CameraHealth {
  camera_id: string;
  last_frame_at?: string;
  error_count: number;
  last_error?: string;
  status: 'online' | 'offline' | 'error' | 'unknown';
}

// API response for latest detection
interface LatestDetectionResponse {
  detection: VisionDetection;
  thumbnail_url: string;
  camera: CameraMapping;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Confidence threshold filtering
*For any* set of detection results from Workers AI, the filtered output SHALL only contain objects with confidence scores strictly greater than 0.5.
**Validates: Requirements 1.2**

### Property 2: Camera mapping storage
*For any* valid camera registration request, after storage, querying by camera_id SHALL return the exact camera_id, station_id, and rtsp_url that were submitted.
**Validates: Requirements 2.1**

### Property 3: Camera-to-station association
*For any* frame submitted with a registered camera_id, the resulting Detection_Result SHALL have a station_id matching the registered mapping for that camera.
**Validates: Requirements 2.2**

### Property 4: Camera mapping update
*For any* camera mapping that is updated, subsequent queries SHALL return the updated values, not the original values.
**Validates: Requirements 2.3**

### Property 5: Camera mapping deletion
*For any* camera mapping that is deleted, subsequent frame submissions for that camera_id SHALL be rejected.
**Validates: Requirements 2.4**

### Property 6: Image format validation
*For any* byte array submitted as a frame, the API SHALL accept it if and only if it is a valid JPEG or PNG image.
**Validates: Requirements 3.1**

### Property 7: Image size validation
*For any* image submitted as a frame, if the image size exceeds 10MB, the API SHALL reject it with an error.
**Validates: Requirements 3.2**

### Property 8: Image resize constraint
*For any* image larger than 1920x1080 pixels, after resizing, the output dimensions SHALL be at most 1920x1080 while maintaining aspect ratio.
**Validates: Requirements 3.3**

### Property 9: Detection result schema transformation
*For any* raw Workers AI detection response, the transformed output SHALL conform to the HeySalad DetectedObject schema with label, confidence, and bbox fields.
**Validates: Requirements 3.4**

### Property 10: Detection result round-trip serialization
*For any* valid VisionDetection object, serializing to JSON and deserializing back SHALL produce an equivalent object.
**Validates: Requirements 3.5, 3.6**

### Property 11: Thumbnail size constraint
*For any* frame processed for thumbnail storage, the resulting thumbnail dimensions SHALL be at most 640x480 pixels.
**Validates: Requirements 4.1**

### Property 12: Camera offline timeout
*For any* camera that has not sent frames for more than 60 seconds, the health status SHALL be 'offline'.
**Validates: Requirements 5.4**

### Property 13: Authentication rejection
*For any* request to the vision API without a valid API key, the response status SHALL be 401.
**Validates: Requirements 7.2**

## Error Handling

### RPi Client Errors

| Error | Handling |
|-------|----------|
| RTSP connection failed | Retry with exponential backoff (1s, 2s, 4s, 8s, 16s), then log and skip |
| Frame capture timeout | Log warning, continue to next interval |
| API request failed | Retry once, then log and continue |
| Invalid API key | Log error and exit |

### Cloud Vision API Errors

| Error | HTTP Status | Response |
|-------|-------------|----------|
| Missing API key | 401 | `{ "error": "Authentication required" }` |
| Invalid API key | 401 | `{ "error": "Invalid API key" }` |
| Unknown camera_id | 404 | `{ "error": "Camera not registered" }` |
| Invalid image format | 400 | `{ "error": "Invalid image format. Must be JPEG or PNG" }` |
| Image too large | 413 | `{ "error": "Image exceeds 10MB limit" }` |
| Workers AI error | 502 | `{ "error": "AI service unavailable" }` |
| Internal error | 500 | `{ "error": "Internal server error" }` |

## Testing Strategy

### Unit Testing

Unit tests verify specific functions and edge cases:

- Image format detection (JPEG magic bytes, PNG signature)
- Image size calculation
- Confidence threshold filtering
- Schema transformation
- Thumbnail generation
- Camera status timeout logic

### Property-Based Testing

Property-based tests use **fast-check** library to verify universal properties across many random inputs.

**Configuration:**
- Minimum 100 iterations per property
- Each test tagged with: `**Feature: cloud-vision-integration, Property {N}: {description}**`

**Properties to test:**
1. Confidence filtering always excludes low-confidence results
2. Camera CRUD operations maintain data integrity
3. Image validation correctly identifies valid/invalid formats
4. Serialization round-trips preserve data
5. Resize operations respect dimension constraints
6. Authentication always rejects invalid keys

### Integration Testing

Integration tests verify end-to-end flows:

- RPi client → API → Workers AI → Response
- Camera registration → Frame submission → Detection storage
- Health monitoring and offline detection

