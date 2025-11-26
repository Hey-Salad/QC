# HeySalad QC

A quality control system for food preparation stations with AI-powered object detection. The system uses camera feeds to automatically verify order completeness by detecting items placed on QC mats.

## Architecture

The system consists of three main components:

1. **HeySalad QC Web App** - React/TypeScript frontend for QC operators
2. **Cloud Vision API** - Cloudflare Worker backend with Workers AI for object detection
3. **RPi Vision Client** - Lightweight Python client for Raspberry Pi camera capture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   IP Camera     │────▶│  RPi Client     │────▶│  Cloud Vision   │
│   (RTSP)        │     │  (Python)       │     │  API (Worker)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  HeySalad QC    │
                                                │  Web App        │
                                                └─────────────────┘
```

## Features

- Real-time object detection using Cloudflare Workers AI
- Camera-to-station mapping for multi-station deployments
- Automatic checklist verification based on detected items
- Detection history and logging
- Camera health monitoring
- QR code generation for station identification
- Customizable detection thresholds

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Cloudflare Workers, D1 (SQLite), R2 (Storage)
- **AI**: Cloudflare Workers AI (DETR ResNet-50)
- **Edge Client**: Python 3.9+, ffmpeg

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers, D1, and R2 enabled
- Wrangler CLI (`npm install -g wrangler`)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/heysalad-qc.git
cd heysalad-qc
```

2. Install dependencies:
```bash
npm install
```

3. Set up Cloudflare resources:
```bash
# Create D1 database
wrangler d1 create heysalad-qc

# Create R2 bucket for thumbnails
wrangler r2 bucket create vision-thumbnails
```

4. Update `wrangler.toml` with your database and bucket IDs.

5. Run database migrations:
```bash
wrangler d1 execute heysalad-qc --local --file=migrations/0001_initial_schema.sql
wrangler d1 execute heysalad-qc --local --file=migrations/0002_seed_data.sql
wrangler d1 execute heysalad-qc --local --file=migrations/0003_vision_schema.sql
```

### Development

Start the development server:
```bash
npm run dev
```

### Deployment

Deploy to Cloudflare:
```bash
npm run deploy
```

## RPi Vision Client

The `rpi-vision-client/` directory contains a lightweight Python client for Raspberry Pi devices. It captures frames from RTSP cameras and sends them to the Cloud Vision API.

See [rpi-vision-client/README.md](rpi-vision-client/README.md) for installation and configuration instructions.

### Quick Start

```bash
cd rpi-vision-client
pip install -r requirements.txt

python main.py \
  --api-url https://your-api.example.com \
  --api-key YOUR_API_KEY \
  --camera cam1:rtsp://192.168.1.100/stream
```

## API Endpoints

### Vision API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vision/detect` | Submit frame for detection |
| GET | `/api/vision/cameras` | List registered cameras |
| POST | `/api/vision/cameras` | Register camera-station mapping |
| PUT | `/api/vision/cameras/:id` | Update camera mapping |
| DELETE | `/api/vision/cameras/:id` | Delete camera mapping |
| GET | `/api/vision/health` | System health status |
| GET | `/api/vision/latest/:station_id` | Get latest detection |

### Station API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stations` | List all stations |
| POST | `/api/stations` | Create station |
| GET | `/api/stations/:id` | Get station details |
| PUT | `/api/stations/:id` | Update station |
| DELETE | `/api/stations/:id` | Delete station |

## Project Structure

```
heysalad-qc/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Business logic and utilities
│   ├── pages/          # Page components
│   ├── types/          # TypeScript types
│   └── worker.ts       # Cloudflare Worker entry point
├── migrations/         # D1 database migrations
├── rpi-vision-client/  # Raspberry Pi client
└── public/             # Static assets
```

## License

Proprietary - HeySalad Inc.
