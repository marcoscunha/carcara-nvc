from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from pydantic import BaseModel
from pydantic import Field

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models.stream import Stream
from ...services.inference_runtime import inference_runtime_service
from ...services.inference_worker_manager import inference_worker_manager

router = APIRouter()


class WorkerConfigPatchRequest(BaseModel):
    model_name: str | None = None
    task_type: str | None = None
    runtime: str | None = None
    dtype: str | None = None
    providers: list[str] | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    classes: list[int] | None = None


class WorkerWarmupRequest(BaseModel):
    iterations: int = Field(default=3, ge=1, le=50)


def _get_stream_or_404(db: Session, stream_id: int) -> Stream:
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if stream is None:
        raise HTTPException(status_code=404, detail=f"Stream {stream_id} not found")
    return stream


@router.get("/", response_model=list[dict])
def list_workers() -> list[dict]:
    return inference_worker_manager.list_stats()


@router.get("/{stream_id}", response_model=dict)
def get_worker(stream_id: int) -> dict:
    stats = inference_worker_manager.get_worker_stats(stream_id)
    if stats is None:
        raise HTTPException(status_code=404, detail=f"Worker for stream {stream_id} is not running")
    return stats


@router.post("/{stream_id}/start", response_model=dict)
def start_worker(stream_id: int, db: Session = Depends(get_db)) -> dict:
    stream = _get_stream_or_404(db, stream_id)
    metadata = dict(stream.stream_metadata or {})
    metadata["detection_enabled"] = True
    stream.stream_metadata = metadata
    db.add(stream)
    db.commit()
    db.refresh(stream)

    inference_worker_manager.start_worker(stream, runtime=inference_runtime_service.get())
    stats = inference_worker_manager.get_worker_stats(stream_id)
    return {"message": "Worker started", "stream_id": stream_id, "worker": stats}


@router.post("/{stream_id}/stop", response_model=dict)
def stop_worker(stream_id: int) -> dict:
    inference_worker_manager.stop_worker(stream_id)
    return {"message": "Worker stopped", "stream_id": stream_id}


@router.post("/{stream_id}/restart", response_model=dict)
def restart_worker(stream_id: int, db: Session = Depends(get_db)) -> dict:
    stream = _get_stream_or_404(db, stream_id)
    inference_worker_manager.restart_worker(stream, runtime=inference_runtime_service.get())
    stats = inference_worker_manager.get_worker_stats(stream_id)
    return {"message": "Worker restarted", "stream_id": stream_id, "worker": stats}


@router.patch("/{stream_id}/config", response_model=dict)
def patch_worker_config(stream_id: int, payload: WorkerConfigPatchRequest, db: Session = Depends(get_db)) -> dict:
    stream = _get_stream_or_404(db, stream_id)
    metadata = dict(stream.stream_metadata or {})

    if payload.model_name is not None:
        metadata["detection_model"] = payload.model_name
    if payload.task_type is not None:
        metadata["detection_task_type"] = payload.task_type
    if payload.runtime is not None:
        metadata["detection_runtime"] = payload.runtime
    if payload.dtype is not None:
        metadata["detection_dtype"] = payload.dtype
    if payload.providers is not None:
        metadata["detection_providers"] = payload.providers
    if payload.confidence is not None:
        metadata["detection_confidence"] = payload.confidence
    if payload.classes is not None:
        metadata["detection_classes"] = payload.classes

    metadata["detection_enabled"] = True
    stream.stream_metadata = metadata
    db.add(stream)
    db.commit()
    db.refresh(stream)

    inference_worker_manager.restart_worker(stream, runtime=inference_runtime_service.get())
    stats = inference_worker_manager.get_worker_stats(stream_id)
    return {"message": "Worker config updated", "stream_id": stream_id, "worker": stats}


@router.post("/{stream_id}/warmup", response_model=dict)
def warmup_worker(stream_id: int, payload: WorkerWarmupRequest) -> dict:
    metrics = inference_worker_manager.warmup_worker(stream_id, payload.iterations)
    if metrics is None:
        raise HTTPException(status_code=404, detail=f"Worker for stream {stream_id} is not running")
    return {"stream_id": stream_id, "warmup": metrics}


@router.post("/actions/stop-all", response_model=dict)
def stop_all_workers() -> dict:
    running_before = len(inference_worker_manager.get_running_stream_ids())
    inference_worker_manager.stop_all()
    return {"message": "All workers stopped", "stopped_workers": running_before}


@router.post("/actions/restart-all", response_model=dict)
def restart_all_workers(db: Session = Depends(get_db)) -> dict:
    active_streams = db.query(Stream).filter(Stream.status == "active").all()
    restarted = inference_worker_manager.restart_all(active_streams, runtime=inference_runtime_service.get())
    return {"message": "All workers restarted", "restarted_workers": restarted}
