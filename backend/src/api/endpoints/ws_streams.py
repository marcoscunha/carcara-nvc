import asyncio
from collections import defaultdict
from threading import Lock

import cv2
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models.stream import Stream

router = APIRouter()


class CameraStreamManager:
    def __init__(self, camera_device_id: int):
        self.camera_device_id = camera_device_id
        self.streamer = None
        self.subscribers = []
        self.lock = Lock()
        self.status = "stopped"

    def start_stream(self, camera_device_id: int):
        with self.lock:
            cap = cv2.VideoCapture(camera_device_id)
            if not cap.isOpened():
                print(f"==============================================================================")
                print(f"STARTING for camera")
                print(f"==============================================================================")
                cap.release()
                raise HTTPException(status_code=400, detail=f"Cannot open camera {camera_device_id}")

            self.streamer = cap
            self.status = "started"
            print(f"==============================================================================")
            print(f"STARTING for camera {camera_device_id}")
            print(f"==============================================================================")

    def stop_stream(self):
        print(f"==============================================================================")
        print(f"Stopping stream for camera {self.streamer} - cameras {len(self.subscribers)}")
        print(f"==============================================================================")
        self.streamer.release()
        self.streamer = None
        self.subscribers = []

    def kill_stream(self):
        """Forcefully stop the stream and remove all subscribers."""
        with self.lock:
            print(f"==============================================================================")
            print(f"Killing stream for camera {self.camera_device_id}")
            print(f"==============================================================================")
            if self.streamer:
                self.streamer.release()
                self.streamer = None
            self.subscribers.clear()
            self.status = "stopped"

    async def publish_frames(self):
        cap = self.streamer

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            _, buffer = cv2.imencode('.jpg', frame)
            for subscriber in self.subscribers:
                try:
                    await subscriber.send_bytes(buffer.tobytes())
                except WebSocketDisconnect:
                    self.subscribers.remove(subscriber)  # Remove disconnected subscriber
            await asyncio.sleep(1 / 30)

    def add_subscriber(self, websocket: WebSocket):
        self.subscribers.append(websocket)  # Add WebSocket to the list

    def remove_subscriber(self, websocket: WebSocket):
        with self.lock:
            print(f"==============================================================================")
            print(f" REMOVING SUBSCRIBER  {len(self.subscribers)}")
            print(f"==============================================================================")
            if websocket in self.subscribers:
                self.subscribers.remove(websocket)  # Remove WebSocket from the list
            if not self.subscribers:
                self.stop_stream()


camera_stream_managers = {
    "local": defaultdict(list),
    "remote": defaultdict(list)
}

camera_stream_lockers = {
    "local": defaultdict(Lock),
    "remote": defaultdict(Lock)
}


@router.websocket("/{stream_id}")
async def stream_camera(websocket: WebSocket,
                        stream_id: int,
                        db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        # Retrieve the camera_id associated with the stream_id
        stream = db.query(Stream).filter(Stream.id == stream_id).first()
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")

        # Ensure the camera is local
        if stream.camera.camera_type != "local":
            raise HTTPException(status_code=400, detail="Only local cameras are supported")

        camera_device_id = stream.camera.device_id

        # Safely access or create the CameraStreamManager
        with camera_stream_lockers["local"][camera_device_id]:
            camera_stream_manager = camera_stream_managers["local"].get(camera_device_id)
            if camera_stream_manager is None:
                # Create a new CameraStreamManager if it doesn't exist
                camera_stream_manager = CameraStreamManager(camera_device_id)
                camera_stream_managers["local"][camera_device_id] = camera_stream_manager

            # if len(camera_stream_manager.subscribers) == 0:
                camera_stream_manager.start_stream(camera_device_id)

            # Add the subscriber to the manager
            camera_stream_manager.add_subscriber(websocket)

        # If there is just one subscriber, start the frame publishing
        if len(camera_stream_manager.subscribers) == 1:
            await camera_stream_manager.publish_frames()
        else:
            # If there are multiple subscribers, just wait for the frames to be published
            while True:
                await asyncio.sleep(1)
    except Exception as e:
        print(f"Error in WebSocket stream: {e}")
    except:
        # Print the trace of the error
        import traceback
        traceback.print_exc()
        print(f"Error in WebSocket stream: {e}")
    finally:
        # Remove the subscriber and close the WebSocket
        camera_stream_manager.remove_subscriber(websocket)
        await websocket.close()


@router.delete("/kill/{camera_device_id}")
async def kill_camera_stream(camera_device_id: int):
    """Endpoint to kill a specific camera stream."""
    with camera_stream_lockers["local"][camera_device_id]:
        camera_stream_manager = camera_stream_managers["local"].get(camera_device_id)
        if camera_stream_manager:
            camera_stream_manager.kill_stream()
            del camera_stream_managers["local"][camera_device_id]
            return {"message": f"Stream for camera {camera_device_id} has been killed."}
        else:
            raise HTTPException(status_code=404, detail="Stream not found")
