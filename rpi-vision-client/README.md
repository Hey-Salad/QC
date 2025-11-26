# HeySalad Vision Client for Raspberry Pi

A lightweight Python client that captures frames from RTSP cameras and sends them to the HeySalad Cloud Vision API for object detection.

## Features

- **Lightweight**: Uses less than 15% CPU and 100MB RAM on average
- **Efficient**: Single frame capture (no continuous streaming)
- **Reliable**: Exponential backoff retry for RTSP connection failures
- **Secure**: API key authentication over HTTPS
- **Configurable**: Multiple cameras, adjustable intervals

## Requirements

- Raspberry Pi (3B+ or newer recommended)
- Python 3.9+
- ffmpeg installed (`sudo apt install ffmpeg`)
- Network access to RTSP cameras and Cloud Vision API

## Installation

1. Clone or copy the client files to your Raspberry Pi:

```bash
mkdir -p ~/heysalad-vision
cd ~/heysalad-vision
# Copy main.py and requirements.txt here
```

2. Create a virtual environment (recommended):

```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Install ffmpeg if not already installed:

```bash
sudo apt update
sudo apt install ffmpeg
```

## Configuration

The client can be configured via command line arguments, environment variables, or a JSON config file.

### Command Line Arguments

```bash
python main.py \
  --api-url https://your-api.example.com \
  --api-key YOUR_API_KEY \
  --camera cam1:rtsp://192.168.1.100/stream \
  --camera cam2:rtsp://192.168.1.101/stream \
  --interval 2.0
```

### Environment Variables

```bash
export API_URL=https://your-api.example.com
export API_KEY=YOUR_API_KEY
export CAMERAS='[{"camera_id":"cam1","rtsp_url":"rtsp://192.168.1.100/stream"}]'
export INTERVAL=2.0

python main.py
```

### JSON Config File

Create a `cameras.json` file:

```json
{
  "cameras": [
    {
      "camera_id": "cam1",
      "rtsp_url": "rtsp://192.168.1.100/stream",
      "name": "Station 1 Camera"
    },
    {
      "camera_id": "cam2",
      "rtsp_url": "rtsp://192.168.1.101/stream",
      "name": "Station 2 Camera"
    }
  ]
}
```

Then run:

```bash
python main.py \
  --api-url https://your-api.example.com \
  --api-key YOUR_API_KEY \
  --config cameras.json
```

## Command Line Options

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `--api-url` | `API_URL` | (required) | Cloud Vision API URL |
| `--api-key` | `API_KEY` | (required) | API key for authentication |
| `--config` | - | - | Path to JSON config file |
| `--camera` | `CAMERAS` | - | Camera as `id:rtsp_url` (repeatable) |
| `--interval` | `INTERVAL` | 2.0 | Seconds between captures |
| `--max-retries` | `MAX_RETRIES` | 5 | Max RTSP retry attempts |
| `--verbose` | - | false | Enable debug logging |

## Running as a Service

To run the client automatically on boot, create a systemd service.

### 1. Create the service file

```bash
sudo nano /etc/systemd/system/heysalad-vision.service
```

Add the following content:

```ini
[Unit]
Description=HeySalad Vision Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/heysalad-vision
Environment=API_URL=https://your-api.example.com
Environment=API_KEY=YOUR_API_KEY
Environment=CAMERAS=[{"camera_id":"cam1","rtsp_url":"rtsp://192.168.1.100/stream"}]
Environment=INTERVAL=2.0
ExecStart=/home/pi/heysalad-vision/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. Enable and start the service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable heysalad-vision

# Start the service
sudo systemctl start heysalad-vision

# Check status
sudo systemctl status heysalad-vision

# View logs
sudo journalctl -u heysalad-vision -f
```

### 3. Managing the service

```bash
# Stop the service
sudo systemctl stop heysalad-vision

# Restart the service
sudo systemctl restart heysalad-vision

# Disable auto-start
sudo systemctl disable heysalad-vision
```

## Troubleshooting

### ffmpeg not found

Install ffmpeg:
```bash
sudo apt update
sudo apt install ffmpeg
```

### RTSP connection failures

1. Verify the camera is accessible:
   ```bash
   ffmpeg -rtsp_transport tcp -i rtsp://192.168.1.100/stream -frames:v 1 test.jpg
   ```

2. Check network connectivity to the camera

3. Verify the RTSP URL format (consult your camera's documentation)

### Authentication errors

1. Verify your API key is correct
2. Ensure the camera is registered in the Cloud Vision API
3. Check that the API URL is correct (no trailing slash)

### High CPU usage

1. Increase the detection interval: `--interval 5.0`
2. Ensure you're not running other intensive processes
3. Check that ffmpeg is releasing connections properly

## Resource Usage

The client is designed to be lightweight:

- **CPU**: < 15% average (brief spikes during frame capture)
- **RAM**: < 100MB
- **Network**: ~50-200KB per frame (depending on resolution)

## Security Notes

- Always use HTTPS for the API URL
- Store API keys in environment variables, not in code
- Use the systemd service file to manage credentials securely
- Consider using a dedicated API key per Raspberry Pi

## License

Part of the HeySalad QC system.
