#!/usr/bin/env python3
"""
HeySalad Vision Client for Raspberry Pi

A lightweight Python client that captures frames from RTSP cameras
and sends them to the Cloud Vision API for object detection.

Requirements: 1.4, 6.4
"""

import argparse
import json
import logging
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Optional

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class CameraConfig:
    """Configuration for a single camera."""
    camera_id: str
    rtsp_url: str
    name: Optional[str] = None


@dataclass
class ClientConfig:
    """Configuration for the vision client."""
    api_url: str
    api_key: str
    cameras: list[CameraConfig]
    interval: float = 2.0
    max_retries: int = 5


class RPiVisionClient:
    """
    Lightweight vision client for Raspberry Pi.
    
    Captures frames from RTSP cameras periodically and sends them
    to the Cloud Vision API for object detection.
    """
    
    def __init__(self, config: ClientConfig):
        self.config = config
        self.running = False
        self._setup_signal_handlers()
    
    def _setup_signal_handlers(self):
        """Set up handlers for graceful shutdown."""
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)
    
    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info("Shutdown signal received, stopping...")
        self.running = False

    def capture_frame(self, rtsp_url: str) -> Optional[bytes]:
        """
        Capture a single frame from an RTSP stream using ffmpeg.
        
        Releases the connection immediately after capture to minimize
        resource usage (Requirement 6.3).
        
        Args:
            rtsp_url: The RTSP URL to capture from
            
        Returns:
            JPEG bytes of the captured frame, or None on failure
        """
        try:
            # Use ffmpeg to capture a single frame
            # -rtsp_transport tcp: Use TCP for more reliable connection
            # -frames:v 1: Capture only one frame
            # -f image2pipe: Output to pipe
            # -vcodec mjpeg: Output as JPEG
            cmd = [
                'ffmpeg',
                '-rtsp_transport', 'tcp',
                '-i', rtsp_url,
                '-frames:v', '1',
                '-f', 'image2pipe',
                '-vcodec', 'mjpeg',
                '-q:v', '2',  # High quality JPEG
                '-y',  # Overwrite output
                'pipe:1'
            ]
            
            # Run ffmpeg with timeout to prevent hanging
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=10  # 10 second timeout
            )
            
            if result.returncode != 0:
                logger.warning(f"ffmpeg failed: {result.stderr.decode()[:200]}")
                return None
            
            frame_data = result.stdout
            if len(frame_data) == 0:
                logger.warning("ffmpeg returned empty frame")
                return None
                
            return frame_data
            
        except subprocess.TimeoutExpired:
            logger.warning(f"Frame capture timed out for {rtsp_url}")
            return None
        except FileNotFoundError:
            logger.error("ffmpeg not found. Please install ffmpeg.")
            return None
        except Exception as e:
            logger.error(f"Frame capture error: {e}")
            return None

    def capture_frame_with_retry(self, rtsp_url: str) -> Optional[bytes]:
        """
        Capture a frame with exponential backoff retry logic.
        
        Retries up to max_retries times with backoff: 1s, 2s, 4s, 8s, 16s
        (Requirement 1.5)
        
        Args:
            rtsp_url: The RTSP URL to capture from
            
        Returns:
            JPEG bytes of the captured frame, or None after all retries fail
        """
        for attempt in range(self.config.max_retries):
            frame = self.capture_frame(rtsp_url)
            if frame is not None:
                return frame
            
            if attempt < self.config.max_retries - 1:
                # Exponential backoff: 1, 2, 4, 8, 16 seconds
                backoff = 2 ** attempt
                logger.info(f"Retry {attempt + 1}/{self.config.max_retries} in {backoff}s...")
                time.sleep(backoff)
        
        logger.error(f"Failed to capture frame after {self.config.max_retries} attempts")
        return None

    def send_frame(self, camera_id: str, frame: bytes) -> Optional[dict]:
        """
        Send a frame to the Cloud Vision API for detection.
        
        Sends frame as multipart/form-data with API key authentication
        (Requirements 1.1, 7.1, 7.3).
        
        Args:
            camera_id: The camera identifier
            frame: JPEG bytes of the frame
            
        Returns:
            Detection result dict, or None on failure
        """
        url = f"{self.config.api_url}/api/vision/detect"
        
        headers = {
            'X-API-Key': self.config.api_key
        }
        
        files = {
            'frame': ('frame.jpg', frame, 'image/jpeg')
        }
        
        data = {
            'camera_id': camera_id
        }
        
        try:
            response = requests.post(
                url,
                headers=headers,
                files=files,
                data=data,
                timeout=30  # 30 second timeout for API call
            )
            
            if response.status_code == 401:
                logger.error("Authentication failed. Check your API key.")
                return None
            
            if response.status_code == 404:
                logger.error(f"Camera {camera_id} not registered in the system.")
                return None
            
            if response.status_code != 200:
                logger.warning(f"API error {response.status_code}: {response.text[:200]}")
                return None
            
            result = response.json()
            logger.info(
                f"Detection complete: {len(result.get('objects', []))} objects "
                f"in {result.get('processing_time_ms', 0)}ms"
            )
            return result
            
        except requests.exceptions.Timeout:
            logger.warning("API request timed out")
            return None
        except requests.exceptions.ConnectionError:
            logger.warning("Failed to connect to API")
            return None
        except Exception as e:
            logger.error(f"API request error: {e}")
            return None

    def report_error(self, camera_id: str, error_message: str):
        """
        Report a capture error to the health endpoint.
        
        (Requirement 5.2)
        
        Args:
            camera_id: The camera that experienced the error
            error_message: Description of the error
        """
        url = f"{self.config.api_url}/api/vision/health/report"
        
        headers = {
            'X-API-Key': self.config.api_key,
            'Content-Type': 'application/json'
        }
        
        data = {
            'camera_id': camera_id,
            'error': error_message
        }
        
        try:
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=10
            )
            
            if response.status_code != 200:
                logger.warning(f"Failed to report error: {response.status_code}")
                
        except Exception as e:
            logger.warning(f"Could not report error to health endpoint: {e}")

    def process_camera(self, camera: CameraConfig):
        """
        Process a single camera: capture frame and send for detection.
        
        Args:
            camera: The camera configuration
        """
        camera_name = camera.name or camera.camera_id
        logger.debug(f"Processing camera: {camera_name}")
        
        # Capture frame with retry logic
        frame = self.capture_frame_with_retry(camera.rtsp_url)
        
        if frame is None:
            error_msg = f"Failed to capture frame from {camera.rtsp_url}"
            logger.warning(error_msg)
            self.report_error(camera.camera_id, error_msg)
            return
        
        logger.info(f"Captured frame from {camera_name}: {len(frame)} bytes")
        
        # Send frame for detection
        result = self.send_frame(camera.camera_id, frame)
        
        if result is None:
            logger.warning(f"Detection failed for camera {camera_name}")

    def run(self):
        """
        Main loop: capture frames at configured interval.
        
        Sleeps between captures to minimize resource usage (Requirement 6.4).
        """
        logger.info(f"Starting vision client with {len(self.config.cameras)} camera(s)")
        logger.info(f"Detection interval: {self.config.interval}s")
        logger.info(f"API URL: {self.config.api_url}")
        
        self.running = True
        
        while self.running:
            cycle_start = time.time()
            
            # Process each camera
            for camera in self.config.cameras:
                if not self.running:
                    break
                self.process_camera(camera)
            
            # Calculate sleep time to maintain interval
            elapsed = time.time() - cycle_start
            sleep_time = max(0, self.config.interval - elapsed)
            
            if sleep_time > 0 and self.running:
                logger.debug(f"Sleeping for {sleep_time:.1f}s")
                time.sleep(sleep_time)
        
        logger.info("Vision client stopped")


def load_cameras_from_file(filepath: str) -> list[CameraConfig]:
    """Load camera configurations from a JSON file."""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    cameras = []
    for cam in data.get('cameras', []):
        cameras.append(CameraConfig(
            camera_id=cam['camera_id'],
            rtsp_url=cam['rtsp_url'],
            name=cam.get('name')
        ))
    
    return cameras


def load_cameras_from_env() -> list[CameraConfig]:
    """
    Load camera configurations from environment variables.
    
    Format: CAMERAS='[{"camera_id":"cam1","rtsp_url":"rtsp://..."}]'
    """
    cameras_json = os.environ.get('CAMERAS', '[]')
    data = json.loads(cameras_json)
    
    cameras = []
    for cam in data:
        cameras.append(CameraConfig(
            camera_id=cam['camera_id'],
            rtsp_url=cam['rtsp_url'],
            name=cam.get('name')
        ))
    
    return cameras


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='HeySalad Vision Client for Raspberry Pi',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Using command line arguments
  python main.py --api-url https://api.example.com --api-key YOUR_KEY \\
    --camera cam1:rtsp://192.168.1.100/stream

  # Using a config file
  python main.py --api-url https://api.example.com --api-key YOUR_KEY \\
    --config cameras.json

  # Using environment variables
  export API_URL=https://api.example.com
  export API_KEY=YOUR_KEY
  export CAMERAS='[{"camera_id":"cam1","rtsp_url":"rtsp://192.168.1.100/stream"}]'
  python main.py
        """
    )
    
    parser.add_argument(
        '--api-url',
        default=os.environ.get('API_URL'),
        help='Cloud Vision API URL (or set API_URL env var)'
    )
    
    parser.add_argument(
        '--api-key',
        default=os.environ.get('API_KEY'),
        help='API key for authentication (or set API_KEY env var)'
    )
    
    parser.add_argument(
        '--config',
        help='Path to JSON config file with camera definitions'
    )
    
    parser.add_argument(
        '--camera',
        action='append',
        dest='cameras',
        help='Camera definition as camera_id:rtsp_url (can be repeated)'
    )
    
    parser.add_argument(
        '--interval',
        type=float,
        default=float(os.environ.get('INTERVAL', '2.0')),
        help='Detection interval in seconds (default: 2.0)'
    )
    
    parser.add_argument(
        '--max-retries',
        type=int,
        default=int(os.environ.get('MAX_RETRIES', '5')),
        help='Maximum retry attempts for RTSP connection (default: 5)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Validate required arguments
    if not args.api_url:
        logger.error("API URL is required. Use --api-url or set API_URL env var.")
        sys.exit(1)
    
    if not args.api_key:
        logger.error("API key is required. Use --api-key or set API_KEY env var.")
        sys.exit(1)
    
    # Load camera configurations
    cameras = []
    
    if args.config:
        # Load from config file
        try:
            cameras = load_cameras_from_file(args.config)
            logger.info(f"Loaded {len(cameras)} camera(s) from {args.config}")
        except Exception as e:
            logger.error(f"Failed to load config file: {e}")
            sys.exit(1)
    elif args.cameras:
        # Parse from command line
        for cam_str in args.cameras:
            try:
                camera_id, rtsp_url = cam_str.split(':', 1)
                cameras.append(CameraConfig(
                    camera_id=camera_id,
                    rtsp_url=rtsp_url
                ))
            except ValueError:
                logger.error(f"Invalid camera format: {cam_str}")
                logger.error("Expected format: camera_id:rtsp_url")
                sys.exit(1)
    else:
        # Try loading from environment
        cameras = load_cameras_from_env()
    
    if not cameras:
        logger.error("No cameras configured. Use --camera, --config, or CAMERAS env var.")
        sys.exit(1)
    
    # Create and run client
    config = ClientConfig(
        api_url=args.api_url.rstrip('/'),
        api_key=args.api_key,
        cameras=cameras,
        interval=args.interval,
        max_retries=args.max_retries
    )
    
    client = RPiVisionClient(config)
    client.run()


if __name__ == '__main__':
    main()
