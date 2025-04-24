from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ROIBase(BaseModel):
    name: str
    camera_id: int
    points: List[List[float]]


class ROICreate(ROIBase):
    pass


class ROIUpdate(BaseModel):
    name: Optional[str] = None
    camera_id: Optional[int] = None
    points: Optional[List[List[float]]] = None


class ROIResponse(ROIBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True