from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ROIBase(BaseModel):
    camera_id: int
    name: str
    points: List[float]  # [x1, y1, x2, y2, ...]
    is_active: bool = True


class ROICreate(ROIBase):
    pass


class ROIUpdate(ROIBase):
    name: Optional[str] = None
    points: Optional[List[float]] = None
    is_active: Optional[bool] = None


class ROIResponse(ROIBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True