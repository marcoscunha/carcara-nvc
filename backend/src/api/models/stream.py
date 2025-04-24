from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class StreamBase(BaseModel):
    camera_id: int
    metadata: Optional[Dict[str, Any]] = None


class StreamCreate(StreamBase):
    pass


class StreamUpdate(BaseModel):
    status: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class StreamResponse(StreamBase):
    id: int
    status: str
    current_frame: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True