from datetime import datetime
from typing import Any
from typing import Dict
from typing import Optional

from pydantic import BaseModel


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
