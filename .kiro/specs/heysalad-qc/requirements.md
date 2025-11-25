# Requirements Document

## Introduction

HeySalad QC is a web application for generating printable QR code quality control mats and managing camera-based inspection stations for restaurants and food businesses. The system enables food service operations to create QC stations, generate printable mats with QR codes, and monitor quality control checkpoints through a dashboard interface with mock detection capabilities. The application deploys on Cloudflare Workers with Pages for the frontend.

## Glossary

- **Station**: A physical quality control checkpoint in a restaurant (e.g., packing station, prep area, storage section)
- **QC Mat**: A printable A4 document containing a QR code and detection zone boundaries for placement at a station
- **Detection Zone**: A defined area on the mat where items are placed for quality inspection
- **Detection Rule**: Configuration specifying expected items, confidence thresholds, and alert settings for a station
- **Detection Log**: A historical record of quality control checks performed at a station
- **Confidence Threshold**: A decimal value (0.0-1.0) indicating minimum acceptable detection certainty
- **D1**: Cloudflare's serverless SQLite database service
- **R2**: Cloudflare's object storage service for storing generated PDFs
- **Workers**: Cloudflare's serverless function platform

## Requirements

### Requirement 1

**User Story:** As a restaurant manager, I want to create and manage QC stations, so that I can organize quality control checkpoints throughout my facility.

#### Acceptance Criteria

1. WHEN a user submits a new station form with name, type, and optional location/description THEN the System SHALL create a station record with a unique UUID and store it in the D1 database
2. WHEN a user requests the station list THEN the System SHALL display all stations in a table showing name, type, created date, and QR code preview
3. WHEN a user clicks edit on a station THEN the System SHALL allow modification of station name, type, location, and description fields
4. WHEN a user confirms station deletion THEN the System SHALL remove the station record and associated detection rules from the database
5. WHEN a user selects multiple stations and clicks bulk generate THEN the System SHALL queue mat generation for each selected station

### Requirement 2

**User Story:** As a restaurant manager, I want to generate printable QR code mats, so that I can place them at physical QC stations for scanning.

#### Acceptance Criteria

1. WHEN a user selects a station and layout option (1x1, 2x1, or 2x2) THEN the System SHALL render a live preview of the A4 mat design
2. WHEN the mat preview renders THEN the System SHALL display a dashed detection boundary, HeySalad logo, QR code (50mm x 50mm), station name, and bilingual labels
3. WHEN a user clicks download PDF THEN the System SHALL generate a print-optimized A4 PDF (210mm x 297mm) at 300 DPI resolution
4. WHEN the QR code generates THEN the System SHALL encode the URL format `https://qc.heysalad.app/station/{station_id}`
5. WHEN the PDF generates successfully THEN the System SHALL store the file in R2 storage and return a download URL
6. WHEN a user requests a mat with 2x2 layout THEN the System SHALL render four detection zones in a grid arrangement on a single A4 page

### Requirement 3

**User Story:** As a QC operator, I want to view a station dashboard, so that I can monitor quality control checks in real-time.

#### Acceptance Criteria

1. WHEN a user navigates to `/station/{station_id}` THEN the System SHALL display station details including name, type, and location
2. WHEN the dashboard loads THEN the System SHALL show a camera feed placeholder area (640x480 pixels)
3. WHEN detection results are available THEN the System SHALL display bounding boxes, confidence scores, and object labels as overlays
4. WHEN comparing expected versus detected items THEN the System SHALL show a checklist with green checkmarks for found items and red X marks for missing items
5. WHEN displaying detection history THEN the System SHALL show the last 20 detections with timestamps, thumbnails, and pass/fail status
6. WHEN a user clicks manual scan trigger THEN the System SHALL process a mock detection and display results

### Requirement 4

**User Story:** As a restaurant manager, I want to configure detection rules for each station, so that I can define what items must be present for quality approval.

#### Acceptance Criteria

1. WHEN a user adds an expected item THEN the System SHALL allow selection from a dropdown or free text entry
2. WHEN a user sets a confidence threshold THEN the System SHALL accept a decimal value between 0.0 and 1.0
3. WHEN a user marks an item as required THEN the System SHALL flag missing required items as failures in detection results
4. WHEN a user draws on the detection zone canvas THEN the System SHALL save the zone coordinates for that station
5. WHEN a user enables alerts THEN the System SHALL display input fields for email, Slack webhook, and SMS channels
6. WHEN a user saves detection rules THEN the System SHALL persist the configuration to the detection_rules table

### Requirement 5

**User Story:** As a developer, I want RESTful API endpoints, so that the frontend can communicate with the backend services.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/stations` THEN the System SHALL return a JSON array of all station records
2. WHEN a POST request is made to `/api/stations` with valid station data THEN the System SHALL create a new station and return the created record with HTTP 201
3. WHEN a PUT request is made to `/api/stations/{id}` with updated data THEN the System SHALL modify the existing station record
4. WHEN a DELETE request is made to `/api/stations/{id}` THEN the System SHALL remove the station and return HTTP 204
5. WHEN a POST request is made to `/api/generate-mat` with station_id and layout THEN the System SHALL return a PDF download URL
6. WHEN a POST request is made to `/api/detect` with station_id and image_data THEN the System SHALL return mock detection results in JSON format
7. WHEN a GET request is made to `/api/stations/{id}/logs` THEN the System SHALL return detection history for that station
8. WHEN a PUT request is made to `/api/stations/{id}/rules` with rule configuration THEN the System SHALL update the detection rules

### Requirement 6

**User Story:** As a user, I want a responsive and branded interface, so that I can use the application on any device with a consistent HeySalad experience.

#### Acceptance Criteria

1. WHEN the application renders THEN the System SHALL apply HeySalad brand colors (tomato red primary, fresh green accent, neutral grays)
2. WHEN viewed on mobile devices THEN the System SHALL adapt the layout responsively using TailwindCSS utilities
3. WHEN displaying station information THEN the System SHALL use the StationCard component with action buttons
4. WHEN showing detection status THEN the System SHALL display AlertBadge components indicating pass, fail, or warning states
5. WHEN rendering the mat preview THEN the System SHALL match the aesthetic from the HeySalad QC PDF design (black dashed borders, minimalist style)

### Requirement 7

**User Story:** As a developer, I want proper database schema and storage configuration, so that data persists reliably across the application.

#### Acceptance Criteria

1. WHEN the application initializes THEN the System SHALL connect to Cloudflare D1 database with stations, detection_rules, and detection_logs tables
2. WHEN a station is created THEN the System SHALL generate a UUID primary key and set created_at timestamp
3. WHEN detection rules are saved THEN the System SHALL store expected_items and alert_config as JSON strings
4. WHEN a PDF is generated THEN the System SHALL upload the file to Cloudflare R2 bucket and store the URL reference
5. WHEN a station is updated THEN the System SHALL set the updated_at timestamp to current time

### Requirement 8

**User Story:** As a developer, I want to serialize station and detection data to JSON for API responses, so that the frontend can consume structured data.

#### Acceptance Criteria

1. WHEN serializing a station record THEN the System SHALL output valid JSON containing id, name, type, location, description, qr_code_url, created_at, and updated_at fields
2. WHEN serializing detection results THEN the System SHALL output valid JSON containing detected_objects array, expected_objects array, timestamp, pass boolean, and missing array
3. WHEN deserializing API request bodies THEN the System SHALL parse JSON input and validate required fields before processing
4. WHEN serializing detection rules THEN the System SHALL output valid JSON containing expected_items array, confidence_threshold, and alert_config object
5. WHEN round-trip serializing any data model THEN the System SHALL produce equivalent data after serialize then deserialize operations
