import cv2
import numpy as np
from ultralytics import YOLO
from typing import List, Dict, Any, Optional
import torch
import subprocess
import os

from ..core.config import settings


class ObjectDetectionService:
    def __init__(self, detection_model_name: str = settings.DEFAULT_MODEL):
        self.detection_model_name = detection_model_name
        self.device = self._get_device()
        self.model = self._load_model()
        self.confidence_threshold = settings.CONFIDENCE_THRESHOLD

    def _get_device(self) -> str:
        """Detect if CUDA is available and return appropriate device."""
        try:
            # Check if nvidia-smi is available
            subprocess.run(['nvidia-smi'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            # Check if CUDA is available in PyTorch
            if torch.cuda.is_available():
                return "cuda"
        except (subprocess.SubprocessError, FileNotFoundError):
            pass
        return "cpu"

    def _load_model(self) -> YOLO:
        """Load the YOLO model with appropriate device settings."""
        print(f"Loading model on {self.device} device...")
        return YOLO(self.detection_model_name).to(self.device)

    def scan_local_cameras(self, max_devices: int = 10) -> List[Dict[str, Any]]:
        """
        Scan for available local camera devices.

        Args:
            max_devices: Maximum number of devices to scan (default: 10)

        Returns:
            List of dictionaries containing device information:
            {
                "device_id": int,
                "name": str,
                "resolution": tuple,
                "fps": float,
                "is_available": bool
            }
        """
        available_cameras = []

        for device_id in range(max_devices):
            try:
                cap = cv2.VideoCapture(device_id)
                if cap.isOpened():
                    # Get camera properties
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    fps = cap.get(cv2.CAP_PROP_FPS)

                    # Try to get a frame to confirm camera is working
                    ret, frame = cap.read()
                    is_available = ret and frame is not None

                    camera_info = {
                        "device_id": device_id,
                        "name": f"Camera {device_id}",
                        "resolution": (width, height),
                        "fps": fps,
                        "is_available": is_available
                    }

                    available_cameras.append(camera_info)
                cap.release()
            except Exception as e:
                print(f"Error accessing camera {device_id}: {str(e)}")
                continue

        return available_cameras

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Perform object detection on a single frame.

        Args:
            frame: numpy array containing the image

        Returns:
            List of detections with bounding boxes and class information
        """
        results = self.model(frame, conf=self.confidence_threshold)[0]
        detections = []

        for box in results.boxes:
            detection = {
                "bbox": box.xyxy[0].tolist(),
                "confidence": float(box.conf[0]),
                "class_name": results.names[int(box.cls[0])],
                "class_id": int(box.cls[0])
            }
            detections.append(detection)

        return detections

    def process_stream(self, stream_url: str, camera_type: str = "rtsp", device_id: Optional[int] = None) -> Optional[np.ndarray]:
        """
        Process a video stream and return the current frame.

        Args:
            stream_url: URL of the video stream (for RTSP cameras)
            camera_type: Type of camera ("rtsp" or "local")
            device_id: Device ID for local cameras

        Returns:
            Current frame as numpy array or None if stream is not available
        """
        if camera_type == "local":
            if device_id is None:
                return None
            cap = cv2.VideoCapture(device_id)
        else:
            cap = cv2.VideoCapture(stream_url)

        if not cap.isOpened():
            return None

        ret, frame = cap.read()
        cap.release()

        if not ret:
            return None

        return frame

    def get_available_models(self) -> List[str]:
        """Return list of available YOLO models."""
        return settings.SUPPORTED_MODELS