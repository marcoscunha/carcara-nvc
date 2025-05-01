from typing import List

from fastapi import APIRouter
from fastapi import BackgroundTasks
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session

from ...api.models.stream import StreamCreate
from ...api.models.stream import StreamResponse
from ...api.models.stream import StreamUpdate
from ...db.session import get_db
from ...models.camera import Camera
from ...models.stream import Stream
from ...services.detection import ObjectDetectionService

router = APIRouter()
detection_service = ObjectDetectionService()


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=StreamResponse)
def create_stream(
    stream: StreamCreate,
    db: Session = Depends(get_db)
):
    """Create a new stream for a camera."""
    # Verify camera exists
    camera = db.query(Camera).filter(Camera.id == stream.camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    db_stream = Stream(
        camera_id=stream.camera_id,
        status="active",
        metadata=stream.stream_metadata
    )
    db.add(db_stream)
    db.commit()
    db.refresh(db_stream)
    return db_stream


@router.get("/", response_model=List[StreamResponse])
def list_streams(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all streams."""
    streams = db.query(Stream).offset(skip).limit(limit).all()
    return streams


@router.get("/{stream_id}", response_model=StreamResponse)
def get_stream(
    stream_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific stream by ID."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if stream is None:
        raise HTTPException(status_code=404, detail="Stream not found")
    return stream


@router.put("/{stream_id}", response_model=StreamResponse)
def update_stream(
    stream_id: int,
    stream_update: StreamUpdate,
    db: Session = Depends(get_db)
):
    """Update a stream's status or metadata."""
    db_stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if db_stream is None:
        raise HTTPException(status_code=404, detail="Stream not found")

    for field, value in stream_update.dict(exclude_unset=True).items():
        setattr(db_stream, field, value)

    db.commit()
    db.refresh(db_stream)
    return db_stream


@router.delete("/{stream_id}")
def delete_stream(
    stream_id: int,
    db: Session = Depends(get_db)
):
    """Delete a stream."""
    db_stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if db_stream is None:
        raise HTTPException(status_code=404, detail="Stream not found")

    db.delete(db_stream)
    db.commit()
    return {"message": "Stream deleted successfully"}
