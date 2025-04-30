from datetime import datetime

from sqlalchemy import JSON
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import relationship

from ..db.base_class import Base


class Stream(Base):
    __tablename__ = "streams"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"))
    status = Column(String)  # active, paused, stopped
    current_frame = Column(Integer, default=0)
    stream_metadata = Column(JSON)  # Store additional stream information
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    camera = relationship("Camera", back_populates="streams")
    detections = relationship("Detection", back_populates="stream")
