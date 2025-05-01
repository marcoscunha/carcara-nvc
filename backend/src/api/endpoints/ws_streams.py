import asyncio

import cv2
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models.camera import Camera
from ...models.stream import Stream

router = APIRouter()


@router.websocket("/{stream_id}")
async def stream_camera(websocket: WebSocket,
                        stream_id: str,
                        db: Session = Depends(get_db)):
    """
    Streams camera frames to the frontend via WebSocket.
    :param websocket: WebSocket connection.
    :param stream_id: Camera device ID (int) or RTSP URL (str).
    """
    await websocket.accept()
    # Read the camera ID from the database
    stream = db.query(Stream).filter_by(id=stream_id).first()

    cap = cv2.VideoCapture(stream.camera.device_id)

    if not cap.isOpened():
        await websocket.close()
        raise HTTPException(status_code=400, detail=f"Cannot open camera {stream.camera.device_id}")

    try:
        while True:
            # Read a frame from the camera
            ret, frame = cap.read()
            if not ret:
                break

            # Encode the frame as JPEG
            _, buffer = cv2.imencode('.jpg', frame)

            # Send the frame to the frontend
            await websocket.send_bytes(buffer.tobytes())

            # Limit the frame rate (e.g., 30 FPS)
            await asyncio.sleep(1 / 30)
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for camera {stream_id}")
    except Exception as e:
        print(f"Error streaming camera {stream_id}: {e}")
    finally:
        cap.release()
        await websocket.close()
