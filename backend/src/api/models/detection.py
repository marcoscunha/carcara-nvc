from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class DetectionBase(BaseModel):
    camera_id: int
    stream_id: int
    frame_number: int


class DetectionCreate(DetectionBase):
    pass


class DetectionResponse(DetectionBase):
    id: int
    detection_model_name: str
    confidence: float
    class_name: str
    bbox: List[float]
    metadata: Dict[str, Any]
    timestamp: datetime

    class Config:
        from_attributes = True