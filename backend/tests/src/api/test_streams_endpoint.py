from unittest import TestCase

from fastapi.testclient import TestClient
from src.api.endpoints.streams import router
from src.db.session import get_db
from src.main import app
from src.models.stream import Stream


class StreamsEndpointTests(TestCase):

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
        # Clean up any test data created in the database
        self.db.query(Stream).delete()
        self.db.commit()
        super().tearDown()

    def test_create_stream(self):
        """Test creating a new stream."""
        # Arrange
        payload = {
            "name": "Test Stream",
            "url": "http://example.com/stream",
            "camera_id": 1
        }

        # Act
        response = self.client.post("/streams/", json=payload)

        # Assert
        self.assertEqual(response.status_code, 201, "Stream creation should return status code 201")
        self.assertIn("id", response.json(), "Response should contain the stream ID")
        print(f"Created stream: {response.json()}")

    def test_list_streams(self):
        """Test listing all streams."""
        # Arrange
        self.db.add(Stream(camera_id=1))
        self.db.add(Stream(camera_id=2))
        self.db.commit()

        # Act
        response = self.client.get("/streams/")

        # Assert
        self.assertEqual(response.status_code, 200, "Listing streams should return status code 200")
        self.assertIsInstance(response.json(), list, "Response should be a list of streams")
        print(f"Streams: {response.json()}")

    def test_get_stream(self):
        """Test retrieving a specific stream by ID."""
        # Arrange
        stream = Stream(name="Stream 1", url="http://example.com/stream1", camera_id=1)
        self.db.add(stream)
        self.db.commit()

        # Act
        response = self.client.get(f"/streams/{stream.id}")

        # Assert
        self.assertEqual(response.status_code, 200, "Retrieving a stream should return status code 200")
        self.assertEqual(response.json()["id"], stream.id, "Stream ID should match")
        print(f"Retrieved stream: {response.json()}")

    def test_delete_stream(self):
        """Test deleting a specific stream."""
        # Arrange
        stream = Stream(name="Stream 1", url="http://example.com/stream1", camera_id=1)
        self.db.add(stream)
        self.db.commit()

        # Act
        response = self.client.delete(f"/streams/{stream.id}")

        # Assert
        self.assertEqual(response.status_code, 200, "Deleting a stream should return status code 200")
        self.assertIsNone(self.db.query(Stream).filter_by(id=stream.id).first(), "Stream should be deleted")
        print("Stream deleted successfully.")
