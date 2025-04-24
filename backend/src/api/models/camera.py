from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


class CameraBase(BaseModel):
    name: str
    rtsp_url: str
    is_active: bool = True


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    rtsp_url: Optional[str] = None
    is_active: Optional[bool] = None


class CameraResponse(CameraBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True