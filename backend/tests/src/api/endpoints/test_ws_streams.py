from unittest import TestCase

from fastapi.testclient import TestClient
from src.db.session import get_db
from src.main import app
from src.models.camera import Camera
from src.models.stream import Stream


class WSStreamTests(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        """Set up resources shared across all tests."""
        cls.client = TestClient(app)
        cls.db = next(get_db())
        super().setUpClass()

    @classmethod
    def tearDownClass(cls) -> None:
        """Clean up resources shared across all tests."""
        cls.client = None
        cls.db = None
        super().tearDownClass()

    def setUp(self):
        """Set up resources for each individual test."""
        super().setUp()

    def tearDown(self) -> None:
        """Clean up resources for each individual test."""
        super().tearDown()

    def test_websocket_stream_camera(self):

        # Arrange
        camera = Camera(name="Test Camera", camera_type="local", device_id=4)
        self.db.add(camera)
        self.db.commit()
        camera = self.db.query(Camera).filter_by(name="Test Camera").first()

        stream = Stream(camera_id=camera.id, status="active", stream_metadata={})
        self.db.add(stream)
        self.db.commit()
        stream = self.db.query(Stream).filter_by(camera_id=camera.id).first()

        """Test streaming camera frames via WebSocket."""

        # Act
        with self.client.websocket_connect(f"/api/v1/ws/streams/{stream.id}") as websocket:
            # Simulate receiving a frame
            frame = websocket.receive_bytes()

        # Assert
            self.assertIsInstance(frame, bytes, "Received frame should be in bytes format")
            self.assertGreater(len(frame), 0, "Received frame should not be empty")

        # Cleanup
        self.db.delete(stream)
        self.db.delete(camera)
        self.db.commit()

    def test_websocket_multiple_streams_same_camera(self):
        """Test streaming camera frames via WebSocket."""
        # Arrange
        camera = Camera(name="Test Camera", camera_type="local", device_id=6)
        self.db.add(camera)
        self.db.commit()
        camera = self.db.query(Camera).filter_by(name="Test Camera").first()

        stream_1 = Stream(camera_id=camera.id, status="active", stream_metadata={})
        stream_2 = Stream(camera_id=camera.id, status="active", stream_metadata={})

        self.db.add(stream_1)
        self.db.add(stream_2)
        self.db.commit()
        streams = self.db.query(Stream).filter_by(camera_id=camera.id)

        # Act
        with self.client.websocket_connect(f"/api/v1/ws/streams/{streams[0].id}") as websocket_1:
            # Simulate receiving a frame
            with self.client.websocket_connect(f"/api/v1/ws/streams/{streams[1].id}") as websocket_2:
                frame_1 = websocket_1.receive_bytes()

            # Simulate receiving a frame
                frame_2 = websocket_2.receive_bytes()

            # Assert
                self.assertIsInstance(frame_1, bytes, "Received frame should be in bytes format")
                self.assertGreater(len(frame_1), 0, "Received frame should not be empty")

                self.assertIsInstance(frame_2, bytes, "Received frame should be in bytes format")
                self.assertGreater(len(frame_2), 0, "Received frame should not be empty")

        # Cleanup
        self.db.delete(stream_1)
        self.db.delete(stream_2)
        self.db.delete(camera)
        self.db.commit()
