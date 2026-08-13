"""Helpers to synchronize local camera connectivity with persisted camera/stream state."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from ..models.camera import Camera
from ..models.stream import Stream
from .camera_service import CameraService
from .inference_worker_manager import inference_worker_manager

LOCAL_CAMERA_TYPES = ("local", "usb")
LOCAL_CAMERA_IDENTITY_FIELDS = (
    "device_id",
    "device_path",
    "physical_address",
    "usb_vendor_id",
    "usb_product_id",
    "usb_serial_number",
)


def close_open_alarm_events_for_camera(db: Session, camera_id: int) -> bool:
    """Close any still-open alarm events belonging to a camera's streams.

    Used when a camera goes offline (or is deactivated) so a dead camera does
    not leave alarms stuck in the ``open`` state. Returns True if anything
    changed. ``Alarm.is_active`` (user intent) is intentionally left untouched.
    """
    from datetime import datetime

    from ..models.alarm import AlarmEvent

    stream_ids = [row[0] for row in db.query(Stream.id).filter(Stream.camera_id == camera_id).all()]
    if not stream_ids:
        return False

    open_events = db.query(AlarmEvent).filter(AlarmEvent.stream_id.in_(stream_ids), AlarmEvent.state == "open").all()
    if not open_events:
        return False

    now = datetime.utcnow()
    for event in open_events:
        event.state = "closed"
        event.ended_at = now
    return True


def sync_local_camera_connectivity(db: Session, camera_ids: set[int] | None = None) -> bool:
    """
    Refresh persisted USB identity for local/USB cameras and stop streams that
    point at detached devices. Never modifies `Camera.is_active` — that flag
    reflects user intent and is owned exclusively by the cameras endpoints.

    Updates `Camera.connectivity_status` ('online'/'offline') to reflect whether
    the underlying hardware is currently present, and closes any open alarms for
    cameras that went offline.
    """
    query = db.query(Camera).filter(Camera.camera_type.in_(LOCAL_CAMERA_TYPES))
    if camera_ids:
        query = query.filter(Camera.id.in_(camera_ids))

    cameras = query.all()
    if not cameras:
        return False

    changed = False
    # device_path -> camera_id that first claimed it, so two logical cameras can
    # never bind the same physical node (v4l2 enumeration is unstable, which was
    # a source of swapped feeds).
    claimed_device_paths: dict[str, int] = {}

    for camera in cameras:
        identity = {field: getattr(camera, field, None) for field in LOCAL_CAMERA_IDENTITY_FIELDS}
        resolved = CameraService.resolve_local_camera(**identity)

        if resolved is not None:
            resolved_path = resolved.get("device_path")
            claimed_by = claimed_device_paths.get(resolved_path) if resolved_path else None
            if claimed_by is not None and claimed_by != camera.id:
                # Another camera already owns this node — treat as offline rather
                # than display a feed that belongs to a different camera.
                resolved = None

        if resolved is not None:
            # Hardware is present: refresh persisted identity fields, but do NOT
            # auto-reactivate. `is_active` reflects user intent (manual toggle in
            # the UI) and must only be changed by an explicit user action.
            resolved_path = resolved.get("device_path")
            if resolved_path:
                claimed_device_paths[resolved_path] = camera.id
            for field in LOCAL_CAMERA_IDENTITY_FIELDS:
                new_value = resolved.get(field)
                if getattr(camera, field, None) != new_value:
                    setattr(camera, field, new_value)
                    changed = True
            if camera.connectivity_status != "online":
                camera.connectivity_status = "online"
                changed = True
            continue

        # Hardware is missing: mark the camera offline, stop running streams so we
        # don't keep trying to consume a detached device, and close any open
        # alarms. We still leave `is_active` untouched so the user's intent is
        # preserved across reconnects.
        if camera.connectivity_status != "offline":
            camera.connectivity_status = "offline"
            changed = True

        impacted_streams = (
            db.query(Stream).filter(Stream.camera_id == camera.id, Stream.status.in_(("active", "starting"))).all()
        )

        for stream in impacted_streams:
            if stream.status != "offline":
                stream.status = "offline"
                changed = True
            inference_worker_manager.stop_worker(stream.id)

        if close_open_alarm_events_for_camera(db, camera.id):
            changed = True

    if changed:
        db.commit()

    return changed
