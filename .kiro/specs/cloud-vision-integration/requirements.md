# Requirements Document

## Introduction

This document specifies requirements for a hybrid cloud vision integration system that offloads AI-powered object detection from Raspberry Pi devices to Cloudflare Workers AI. The system captures frames periodically from IP cameras via a lightweight RPi client and sends them to a cloud-based detection API, eliminating the overheating and performance issues caused by running continuous video processing on edge devices.

The integration connects the existing HeySalad QC web application with real camera feeds, replacing the current mock detection system with actual AI-powered object detection.

## Glossary

- **RPi_Client**: A lightweight Python application running on Raspberry Pi that captures frames from RTSP cameras and sends them to the Cloud_Vision_API
- **Cloud_Vision_API**: A Cloudflare Worker endpoint that receives frames and performs object detection using Workers AI
- **Workers_AI**: Cloudflare's serverless AI inference platform providing vision models for object detection
- **Detection_Result**: A structured response containing detected objects with labels, confidence scores, and bounding boxes
- **Frame_Capture**: The process of extracting a single image frame from an RTSP video stream
- **Station_Camera**: An IP camera associated with a specific QC station for monitoring items
- **Detection_Interval**: The time period between consecutive frame captures (default 2 seconds)

## Requirements

### Requirement 1

**User Story:** As a QC operator, I want the system to automatically detect items placed on the QC mat using the station camera, so that I can verify order completeness without manual checking.

#### Acceptance Criteria

1. WHEN the RPi_Client captures a frame from a Station_Camera THEN the Cloud_Vision_API SHALL receive the frame within 3 seconds
2. WHEN the Cloud_Vision_API receives a valid frame THEN Workers_AI SHALL return Detection_Result containing all detected objects with confidence scores above 0.5
3. WHEN a Detection_Result is generated THEN the Cloud_Vision_API SHALL return the result to the requesting client within 5 seconds of frame submission
4. WHEN the RPi_Client is running THEN the RPi_Client SHALL capture frames at the configured Detection_Interval
5. IF the RTSP stream is unavailable THEN the RPi_Client SHALL retry connection with exponential backoff up to 5 attempts

### Requirement 2

**User Story:** As a system administrator, I want to configure camera-to-station mappings, so that detection results are associated with the correct QC stations.

#### Acceptance Criteria

1. WHEN an administrator registers a camera THEN the Cloud_Vision_API SHALL store the camera_id, station_id, and RTSP URL mapping
2. WHEN a frame is submitted with a camera_id THEN the Cloud_Vision_API SHALL associate the Detection_Result with the corresponding station_id
3. WHEN an administrator updates a camera mapping THEN the Cloud_Vision_API SHALL use the new mapping for subsequent detections
4. WHEN an administrator deletes a camera mapping THEN the Cloud_Vision_API SHALL stop accepting frames for that camera_id

### Requirement 3

**User Story:** As a developer, I want the detection API to validate and process frames correctly, so that the system produces reliable detection results.

#### Acceptance Criteria

1. WHEN the Cloud_Vision_API receives a frame THEN the Cloud_Vision_API SHALL validate the image format is JPEG or PNG
2. WHEN the Cloud_Vision_API receives a frame larger than 10MB THEN the Cloud_Vision_API SHALL reject the request with an appropriate error
3. WHEN the Cloud_Vision_API receives a frame THEN the Cloud_Vision_API SHALL resize images larger than 1920x1080 before sending to Workers_AI
4. WHEN Workers_AI returns a Detection_Result THEN the Cloud_Vision_API SHALL transform the result into a standardized format matching the existing HeySalad QC detection schema
5. WHEN serializing Detection_Result THEN the Cloud_Vision_API SHALL produce valid JSON
6. WHEN deserializing Detection_Result JSON THEN the Cloud_Vision_API SHALL reconstruct the original Detection_Result object

### Requirement 4

**User Story:** As a QC operator, I want to see the latest camera frame alongside detection results, so that I can visually verify what the AI detected.

#### Acceptance Criteria

1. WHEN a Detection_Result is stored THEN the Cloud_Vision_API SHALL also store the corresponding frame thumbnail (max 640x480)
2. WHEN the HeySalad QC app requests the latest detection THEN the Cloud_Vision_API SHALL return both the Detection_Result and frame thumbnail URL
3. WHEN displaying detection results THEN the HeySalad_QC_App SHALL overlay bounding boxes on the frame thumbnail
4. WHEN a new detection occurs THEN the HeySalad_QC_App SHALL update the display within 1 second of receiving the result

### Requirement 5

**User Story:** As a system administrator, I want to monitor the health and performance of the vision system, so that I can identify and resolve issues quickly.

#### Acceptance Criteria

1. WHEN the Cloud_Vision_API processes a detection request THEN the Cloud_Vision_API SHALL log the processing time, camera_id, and result count
2. WHEN the RPi_Client fails to capture a frame THEN the RPi_Client SHALL report the error to the Cloud_Vision_API health endpoint
3. WHEN an administrator requests system health THEN the Cloud_Vision_API SHALL return status of all registered cameras including last detection time and error counts
4. WHEN a camera has not sent frames for more than 60 seconds THEN the Cloud_Vision_API SHALL mark the camera status as offline

### Requirement 6

**User Story:** As a developer, I want the RPi client to be lightweight and efficient, so that it does not cause overheating or performance issues on the Raspberry Pi.

#### Acceptance Criteria

1. WHILE the RPi_Client is running THEN the RPi_Client SHALL use less than 15% CPU on average
2. WHILE the RPi_Client is running THEN the RPi_Client SHALL use less than 100MB of RAM
3. WHEN capturing a frame THEN the RPi_Client SHALL release the RTSP connection immediately after capture rather than maintaining a continuous stream
4. WHEN the Detection_Interval is set THEN the RPi_Client SHALL sleep between captures to minimize resource usage

### Requirement 7

**User Story:** As a developer, I want secure communication between components, so that camera feeds and detection data are protected.

#### Acceptance Criteria

1. WHEN the RPi_Client sends a frame THEN the RPi_Client SHALL authenticate using an API key in the request header
2. WHEN the Cloud_Vision_API receives a request without valid authentication THEN the Cloud_Vision_API SHALL reject the request with 401 status
3. WHEN transmitting frames THEN the RPi_Client SHALL use HTTPS to encrypt data in transit
4. WHEN storing API keys THEN the RPi_Client SHALL read keys from environment variables rather than hardcoding

