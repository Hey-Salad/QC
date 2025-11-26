# HeySalad® QC

![HeySalad QC Banner](./public/HeySalad%20QC.svg)

> **AI-powered quality control system for food preparation stations**

A hybrid cloud vision system that uses AI-powered object detection to automatically verify order completeness at QC stations, replacing manual checking with real-time camera-based verification.

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![Workers AI](https://img.shields.io/badge/Workers-AI-purple.svg)](https://developers.cloudflare.com/workers-ai/)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

## 🏆 **Kiroween Hackathon Entry**

**Submitted for the Frankenstein category** - Stitching together multiple technologies into one powerful system.

This project demonstrates:
- Spec-driven development with Kiro
- Cloud-based AI object detection
- Edge computing with Raspberry Pi
- Real-time quality control automation

---

## ✨ **Key Features**

### 🎯 **AI Object Detection**
- Real-time item detection using Cloudflare Workers AI
- DETR ResNet-50 model for accurate object recognition
- Confidence threshold filtering (>0.5)
- Bounding box overlay on camera feeds

### 📷 **Hybrid Cloud Architecture**
- Lightweight RPi client captures frames from RTSP cameras
- Cloud-based processing eliminates edge device overheating
- <15% CPU usage on Raspberry Pi
- 2-second detection intervals

### ✅ **Automated Checklist Verification**
- Auto-check items when detected with high confidence
- Visual feedback with detection overlays
- Detection history and logging
- Station-specific expected items configuration

### 🔐 **Secure API**
- API key authentication
- Camera-to-station mapping
- Health monitoring and offline detection
- R2 thumbnail storage

---

## 🏗 **Architecture**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   IP Camera     │────▶│  RPi Client     │────▶│  Cloud Vision   │
│   (RTSP)        │     │  (Python)       │     │  API (Worker)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                 Cloudflare Edge                                 │
                        │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
                        │  │  Workers AI  │  │     D1       │  │     R2       │          │
                        │  │  (Detection) │  │  (Metadata)  │  │ (Thumbnails) │          │
                        │  └──────────────┘  └──────────────┘  └──────────────┘          │
                        └────────────────────────────────┬────────────────────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  HeySalad QC    │
                                                │  Web App        │
                                                └─────────────────┘
```

---

## 🛠 **Tech Stack**

| Component | Technology |
|-----------|------------|
| **Frontend** | React, TypeScript, Vite, TailwindCSS |
| **Backend** | Cloudflare Workers, Hono |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 |
| **AI Model** | Workers AI (DETR ResNet-50) |
| **Edge Client** | Python 3.9+, ffmpeg |
| **Testing** | Vitest, fast-check (property-based) |

---

## 🚀 **Getting Started**

### **Prerequisites**

- Node.js 18+
- Cloudflare account with Workers, D1, and R2 enabled
- Wrangler CLI (`npm install -g wrangler`)

### **Installation**

```bash
# Clone repository
git clone https://github.com/Hey-Salad/QC.git
cd QC

# Install dependencies
npm install

# Set up Cloudflare resources
wrangler d1 create heysalad-qc
wrangler r2 bucket create vision-thumbnails

# Update wrangler.toml with your database and bucket IDs

# Run database migrations
wrangler d1 execute heysalad-qc --local --file=migrations/0001_initial_schema.sql
wrangler d1 execute heysalad-qc --local --file=migrations/0002_seed_data.sql
wrangler d1 execute heysalad-qc --local --file=migrations/0003_vision_schema.sql
```

### **Development**

```bash
# Start development server
npm run dev

# Run tests
npm test
```

### **Deployment**

```bash
npm run deploy
```

---

## 📡 **RPi Vision Client**

The `rpi-vision-client/` directory contains a lightweight Python client for Raspberry Pi devices.

```bash
cd rpi-vision-client
pip install -r requirements.txt

python main.py \
  --api-url https://your-api.example.com \
  --api-key YOUR_API_KEY \
  --camera cam1:rtsp://192.168.1.100/stream
```

See [rpi-vision-client/README.md](rpi-vision-client/README.md) for full documentation including systemd service setup.

---

## 📚 **API Endpoints**

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

---

## 🧪 **Testing**

This project uses property-based testing with fast-check to verify correctness properties:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### **Correctness Properties Tested**
- Confidence threshold filtering
- Camera mapping CRUD operations
- Image format validation
- Serialization round-trips
- Authentication rejection
- Camera offline timeout detection

---

## 📁 **Project Structure**

```
heysalad-qc/
├── .kiro/
│   ├── specs/              # Kiro spec-driven development
│   │   ├── cloud-vision-integration/
│   │   └── heysalad-qc/
│   └── steering/           # Kiro steering rules
├── src/
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Business logic and utilities
│   ├── pages/              # Page components
│   ├── types/              # TypeScript types
│   └── worker.ts           # Cloudflare Worker entry point
├── migrations/             # D1 database migrations
├── rpi-vision-client/      # Raspberry Pi client
└── public/                 # Static assets
```

---

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## ⚖️ **License**

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

**HeySalad®** (UK Trademark Registration No. **UK00004063403**) is a registered trademark of **SALADHR TECHNOLOGY LTD**.

---

## 🏢 **Company Information**

**SALADHR TECHNOLOGY LTD**  
Company No. 14979493  
Plexal, C/O Blockdojo, Here East  
Queen Elizabeth Olympic Park  
London, England, E20 3BS  

---

## 📞 **Contact & Support**

- **Issues:** [GitHub Issues](https://github.com/Hey-Salad/QC/issues)
- **Email:** [Contact SALADHR TECHNOLOGY LTD](mailto:peter@saladhr.com)

---

<div align="center">

**Built with ❤️ using Kiro spec-driven development**

*AI-powered quality control for the food industry*

[⭐ Star this repo](https://github.com/Hey-Salad/QC) • [🐛 Report Issues](https://github.com/Hey-Salad/QC/issues)

</div>
