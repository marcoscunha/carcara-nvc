import cv2
import numpy as np
from ultralytics import YOLO
from typing import List, Dict, Any, Optional
import torch

from ..core.config import settings


class ObjectDetectionService:
    def __init__(self, model_name: str = settings.DEFAULT_MODEL):
        self.model_name = model_name
        self.model = self._load_model()
        self.confidence_threshold = settings.CONFIDENCE_THRESHOLD

    def _load_model(self) -> YOLO:
        """Load the YOLO model with appropriate device settings."""
        device = "cuda" if settings.USE_GPU and torch.cuda.is_available() else "cpu"
        return YOLO(self.model_name).to(device)

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

    def process_stream(self, stream_url: str) -> Optional[np.ndarray]:
        """
        Process a video stream and return the current frame.

        Args:
            stream_url: URL of the video stream

        Returns:
            Current frame as numpy array or None if stream is not available
        """
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