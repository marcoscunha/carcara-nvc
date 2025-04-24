from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Tuple
from pydantic import BaseModel

from ...db.session import get_db
from ...models.camera import Camera
from ...services.detection import ObjectDetectionService
from ...api.models.camera import CameraCreate, CameraUpdate, CameraResponse

router = APIRouter()
detection_service = ObjectDetectionService()


@router.post("/", response_model=CameraResponse)
def create_camera(
    camera: CameraCreate,
    db: Session = Depends(get_db)
):
    """Create a new IP camera."""
    db_camera = Camera(
        name=camera.name,
        camera_type=camera.camera_type,
        device_id=camera.device_id,
        rtsp_url=camera.rtsp_url,
        is_active=camera.is_active
    )
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)
    return db_camera


@router.get("/", response_model=List[CameraResponse])
def list_cameras(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all cameras."""
    cameras = db.query(Camera).offset(skip).limit(limit).all()
    return cameras


class CameraInfo(BaseModel):
    device_id: int
    name: str
    resolution: List[int]
    fps: float
    is_available: bool


@router.get("/scan", response_model=List[CameraInfo])
async def scan_local_cameras(
    max_devices: int = 10,
    detection_service: ObjectDetectionService = Depends(
        lambda: ObjectDetectionService()
    )
) -> List[CameraInfo]:
    """
    Scan for available local camera devices.

    Args:
        max_devices: Maximum number of devices to scan (default: 10)

    Returns:
        List of available camera devices with their properties
    """
    try:
        cameras = detection_service.scan_local_cameras(max_devices)
        for camera in cameras:
            if isinstance(camera["resolution"], tuple):
                camera["resolution"] = list(camera["resolution"])
        return [CameraInfo(**camera) for camera in cameras]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to scan for cameras: {str(e)}"
        )


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(
    camera_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific camera by ID."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera(
    camera_id: int,
    camera_update: CameraUpdate,
    db: Session = Depends(get_db)
):
    """Update a camera's information."""
    db_camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if db_camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")

    for field, value in camera_update.dict(exclude_unset=True).items():
        setattr(db_camera, field, value)

    db.commit()
    db.refresh(db_camera)
    return db_camera


@router.delete("/{camera_id}")
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db)
):
    """Delete a camera."""
    db_camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if db_camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")

    db.delete(db_camera)
    db.commit()
    return {"message": "Camera deleted successfully"}