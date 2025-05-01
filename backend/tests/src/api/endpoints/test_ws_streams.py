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
        super().tearDownClass()

    def setUp(self):
        """Set up resources for each individual test."""
        super().setUp()

    def tearDown(self) -> None:
        """Clean up resources for each individual test."""
        super().tearDown()

    def test_websocket_stream_camera(self):
        """Test streaming camera frames via WebSocket."""
        # Arrange
        camera = Camera(name="Camera 1", camera_type="local", device_id=4)
        self.db.add(camera)
        self.db.commit()
        camera = self.db.query(Camera).filter_by(name="Camera 1").first()

        stream = Stream(camera_id=camera.id, status="active", stream_metadata={"resolution": "1920x1080"})
        self.db.add(stream)
        self.db.commit()
        stream = self.db.query(Stream).filter_by(camera_id=camera.id).first()

        # Act
        with self.client.websocket_connect(f"/api/v1/ws/streams/{stream.id}") as websocket:
            frame = websocket.receive_bytes()

        # Assert
        self.assertIsInstance(frame, bytes, "Received frame should be in bytes format")
        self.assertGreater(len(frame), 0, "Received frame should not be empty")

        # Clean up
        self.db.query(Stream).filter_by(id=stream.id).delete()
        self.db.commit()
        self.db.query(Camera).filter_by(id=camera.id).delete()
        self.db.commit()
