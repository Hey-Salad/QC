-- HeySalad QC Initial Database Schema
-- Migration: 0001_initial_schema
-- Requirements: 7.1, 7.2

-- Stations table
-- Stores QC station information with UUID primary keys
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('packing', 'prep', 'storage', 'receiving')),
  location TEXT,
  description TEXT,
  qr_code_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Detection rules table
-- Stores detection configuration for each station
CREATE TABLE detection_rules (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  expected_items TEXT NOT NULL,  -- JSON array of ExpectedItem objects
  confidence_threshold REAL DEFAULT 0.75 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  alert_config TEXT,  -- JSON object for AlertConfig
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(station_id)
);

-- Detection logs table
-- Stores historical detection results for each station
CREATE TABLE detection_logs (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  detected_items TEXT NOT NULL,  -- JSON array of DetectedObject
  confidence_scores TEXT,  -- JSON object mapping labels to scores
  pass_fail TEXT NOT NULL CHECK (pass_fail IN ('pass', 'fail')),
  image_url TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
-- Index on station_id for filtering logs by station (Requirement 3.5, 5.7)
CREATE INDEX idx_detection_logs_station ON detection_logs(station_id);

-- Index on timestamp for ordering logs by recency (Requirement 3.5)
CREATE INDEX idx_detection_logs_timestamp ON detection_logs(timestamp DESC);
