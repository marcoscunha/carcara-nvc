from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from ..db.base_class import Base


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    camera_type = Column(String, default="rtsp")  # rtsp or local
    device_id = Column(Integer, nullable=True)  # For local cameras
    rtsp_url = Column(String, unique=True, index=True, nullable=True)  # For RTSP cameras
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    streams = relationship("Stream", back_populates="camera")
    detections = relationship("Detection", back_populates="camera")
    alarms = relationship("Alarm", back_populates="camera")
    rois = relationship("RegionOfInterest", back_populates="camera")