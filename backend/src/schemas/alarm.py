from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class AlarmBase(BaseModel):
    name: str
    camera_id: int
    class_name: str
    confidence_threshold: float
    region_of_interest: List[float]
    is_active: bool = True
    description: Optional[str] = None


class AlarmCreate(AlarmBase):
    pass


class AlarmUpdate(AlarmBase):
    name: Optional[str] = None
    camera_id: Optional[int] = None
    class_name: Optional[str] = None
    confidence_threshold: Optional[float] = None
    region_of_interest: Optional[List[float]] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class AlarmResponse(AlarmBase):
    id: int
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any]

    class Config:
        from_attributes = True