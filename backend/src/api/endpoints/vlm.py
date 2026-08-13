"""
Vision Language Model (VLM) endpoints.

Exposes the VLM analysis capability over HTTP so the frontend can request a
natural-language description of a live frame from a running stream, a registered
camera, or an uploaded image.
"""

import base64
import binascii
import json
import logging
import threading
from collections.abc import Iterator
from urllib.parse import urlparse

import cv2
import numpy as np
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic import Field
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.security import AuthenticatedUser
from ...db.session import get_db
from ...models.camera import Camera
from ...models.stream import Stream
from ...services.camera_service import CameraService
from ...services.inference_worker_manager import inference_worker_manager
from ...services.object_detection import ObjectDetectionService

logger = logging.getLogger(__name__)

router = APIRouter()

LOCAL_CAMERA_TYPES = {"local", "usb"}

# The VLM engine (transformers/ollama) is expensive to initialize, so a single
# instance is reused across requests. Guarded by a lock to avoid concurrent load.
_vlm_service: ObjectDetectionService | None = None
_vlm_lock = threading.Lock()
# Serializes generation so concurrent requests don't clash on the shared model.
_vlm_infer_lock = threading.Lock()


class VlmAnalyzeRequest(BaseModel):
    stream_id: int | None = Field(default=None, description="Running stream to grab the latest frame from")
    camera_id: int | None = Field(default=None, description="Registered camera to capture a live frame from")
    image_base64: str | None = Field(default=None, description="Base64-encoded image to analyze")
    prompt: str | None = Field(default=None, description="Custom prompt for the VLM")


class VlmStatusResponse(BaseModel):
    backend: str
    model: str
    ready: bool


def _get_vlm_service() -> ObjectDetectionService:
    """Return a lazily-initialized, shared VLM detection service."""
    global _vlm_service
    with _vlm_lock:
        if _vlm_service is None:
            _vlm_service = ObjectDetectionService(model_name=settings.VLM_MODEL, model_type="vlm")
        return _vlm_service


def _decode_base64_image(image_base64: str) -> np.ndarray:
    # Tolerate data-URI prefixes like "data:image/jpeg;base64,".
    if "," in image_base64 and image_base64.strip().startswith("data:"):
        image_base64 = image_base64.split(",", 1)[1]
    try:
        raw = base64.b64decode(image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc

    frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image data")
    return frame


def _encode_frame_jpeg(frame: np.ndarray) -> str:
    """Encode a BGR frame to a base64 JPEG data URI for display in the UI."""
    ok, buffer = cv2.imencode(".jpg", frame)
    if not ok:
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")


def _capture_camera_frame(camera: Camera) -> np.ndarray:
    is_local = (camera.camera_type or "").lower() in LOCAL_CAMERA_TYPES
    frame = CameraService.process_stream(
        stream_url=camera.rtsp_url or "",
        camera_type="local" if is_local else "rtsp",
        device_id=camera.device_id,
        device_path=camera.device_path,
    )
    if frame is None:
        raise HTTPException(
            status_code=503,
            detail=f"Could not capture a frame from camera '{camera.name}'",
        )
    return frame


def _mediamtx_rtsp_url(stream_name: str) -> str:
    parsed = urlparse(settings.MEDIAMTX_API_URL)
    host = parsed.hostname or "mediamtx"
    return f"rtsp://{host}:{settings.MEDIAMTX_RTSP_PORT}/{stream_name}"


def _capture_stream_frame(stream: Stream) -> np.ndarray:
    """Grab the latest frame from a running stream without touching the camera device.

    Prefers the in-memory frame already decoded by the stream's inference worker;
    falls back to reading the stream's MediaMTX RTSP output.
    """
    frame = inference_worker_manager.get_snapshot_frame(stream.id)
    if frame is not None:
        return frame

    if stream.stream_name:
        frame = CameraService.process_stream(
            stream_url=_mediamtx_rtsp_url(stream.stream_name),
            camera_type="rtsp",
        )
        if frame is not None:
            return frame

    raise HTTPException(
        status_code=503,
        detail=f"Could not grab a frame from stream '{stream.stream_name or stream.id}'. Is it running?",
    )


@router.get("/status", response_model=VlmStatusResponse)
def vlm_status(current_user: AuthenticatedUser) -> VlmStatusResponse:
    """Report the configured VLM backend/model and whether it is loaded."""
    return VlmStatusResponse(
        backend=settings.VLM_BACKEND,
        model=settings.VLM_MODEL,
        ready=_vlm_service is not None and _vlm_service.is_loaded,
    )


def _resolve_frame(payload: VlmAnalyzeRequest, db: Session) -> np.ndarray:
    """Resolve the source (stream / camera / uploaded image) into a BGR frame."""
    if payload.stream_id is None and payload.camera_id is None and not payload.image_base64:
        raise HTTPException(status_code=400, detail="Provide one of stream_id, camera_id, or image_base64")

    if payload.stream_id is not None:
        stream = db.query(Stream).filter(Stream.id == payload.stream_id).first()
        if stream is None:
            raise HTTPException(status_code=404, detail="Stream not found")
        return _capture_stream_frame(stream)
    if payload.camera_id is not None:
        camera = db.query(Camera).filter(Camera.id == payload.camera_id).first()
        if camera is None:
            raise HTTPException(status_code=404, detail="Camera not found")
        return _capture_camera_frame(camera)
    return _decode_base64_image(payload.image_base64)  # type: ignore[arg-type]


def _sse(event: str, data: dict) -> str:
    """Format a Server-Sent Events message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/analyze/stream")
def analyze_stream(
    payload: VlmAnalyzeRequest,
    current_user: AuthenticatedUser,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """
    Stream a VLM analysis over Server-Sent Events.

    Emits: ``frame`` (base64 JPEG used for evaluation), a sequence of ``token``
    events as the response is generated, a final ``stats`` event with
    tokens-per-second, and a terminating ``done`` event.
    """
    frame = _resolve_frame(payload, db)

    service = _get_vlm_service()
    if not service.is_loaded:
        raise HTTPException(
            status_code=503,
            detail=(
                f"VLM backend '{settings.VLM_BACKEND}' failed to load model "
                f"'{settings.VLM_MODEL}'. Check that the backend is installed and reachable."
            ),
        )

    frame_b64 = _encode_frame_jpeg(frame)
    height, width = frame.shape[:2]

    def event_stream() -> Iterator[str]:
        yield _sse("frame", {"image_base64": frame_b64, "width": int(width), "height": int(height)})
        with _vlm_infer_lock:
            try:
                for kind, value in service.engine.stream_query(frame, payload.prompt or None):
                    if kind == "token":
                        yield _sse("token", {"text": value})
                    elif kind == "stage":
                        yield _sse("stage", {"stage": value})
                    elif kind == "stats":
                        yield _sse(
                            "stats",
                            {**value, "model": settings.VLM_MODEL, "backend": settings.VLM_BACKEND},
                        )
            except Exception as exc:
                logger.exception("VLM streaming failed")
                yield _sse("error", {"detail": f"VLM analysis failed: {exc}"})
        yield _sse("done", {})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
