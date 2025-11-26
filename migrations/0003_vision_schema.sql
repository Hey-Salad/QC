-- HeySalad QC - Cloud Vision Integration Schema
-- Migration: 0003_vision_schema
-- Requirements: 2.1, 4.1, 5.3

-- Camera to station mappings
-- Stores camera_id, station_id, and RTSP URL mapping (Requirement 2.1)
CREATE TABLE camera_mappings (
  camera_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  rtsp_url TEXT NOT NULL,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

-- Index for querying cameras by station
CREATE INDEX idx_camera_mappings_station ON camera_mappings(station_id);

-- Vision detection results
-- Stores detection results with associated camera and station (Requirement 4.1)
CREATE TABLE vision_detections (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  objects_json TEXT NOT NULL,
  thumbnail_key TEXT,
  processing_time_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (camera_id) REFERENCES camera_mappings(camera_id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

-- Indexes for common queries on vision_detections
CREATE INDEX idx_vision_detections_station ON vision_detections(station_id);
CREATE INDEX idx_vision_detections_timestamp ON vision_detections(timestamp DESC);
CREATE INDEX idx_vision_detections_camera ON vision_detections(camera_id);

-- Camera health tracking
-- Tracks camera status, last frame time, and error counts (Requirement 5.3)
CREATE TABLE camera_health (
  camera_id TEXT PRIMARY KEY,
  last_frame_at TEXT,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'error', 'unknown')),
  FOREIGN KEY (camera_id) REFERENCES camera_mappings(camera_id) ON DELETE CASCADE
);
