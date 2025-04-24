from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from ..db.base_class import Base


class RegionOfInterest(Base):
    __tablename__ = "roi"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    camera_id = Column(Integer, ForeignKey("cameras.id"))
    points = Column(JSON)  # Store as array of points
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    camera = relationship("Camera", back_populates="rois")