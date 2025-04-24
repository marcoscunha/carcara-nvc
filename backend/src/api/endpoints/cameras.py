from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

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