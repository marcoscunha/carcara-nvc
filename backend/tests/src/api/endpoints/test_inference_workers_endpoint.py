from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.core.security.oauth2 import settings as auth_settings
from src.db.base_class import Base
from src.db.session import get_db
from src.main import app
from src.models.camera import Camera
from src.models.stream import Stream


class InferenceWorkersEndpointTests(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._previous_auth_enabled = auth_settings.AUTH_ENABLED
        auth_settings.AUTH_ENABLED = False

        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)
        cls.db = cls.TestingSessionLocal()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.db.close()
        Base.metadata.drop_all(bind=cls.engine)
        app.dependency_overrides.clear()
        auth_settings.AUTH_ENABLED = cls._previous_auth_enabled
        cls.client = None
        cls.db = None
        super().tearDownClass()

    def tearDown(self) -> None:
        self.db.query(Stream).delete()
        self.db.query(Camera).delete()
        self.db.commit()
        super().tearDown()

    def _reload_stream(self, stream_id: int) -> Stream:
        db = self.TestingSessionLocal()
        try:
            stream = db.query(Stream).filter(Stream.id == stream_id).first()
            assert stream is not None
            db.expunge(stream)
            return stream
        finally:
            db.close()

    def _seed_stream(self, status: str = "active", metadata: dict | None = None) -> Stream:
        camera = Camera(name=f"Camera {status}", camera_type="local", device_id=1)
        self.db.add(camera)
        self.db.commit()
        stream = Stream(
            camera_id=camera.id,
            stream_name=f"camera_{camera.id}_{status}",
            status=status,
            stream_metadata=metadata or {},
        )
        self.db.add(stream)
        self.db.commit()
        self.db.refresh(stream)
        return stream

    @patch("src.api.endpoints.inference_workers.inference_worker_manager.list_stats")
    def test_list_workers_returns_manager_stats(self, list_stats_mock):
        # Arrange
        list_stats_mock.return_value = [{"stream_id": 1, "runtime": "yolo", "running": True}]

        # Act
        response = self.client.get("/api/v1/inference-workers/")

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["runtime"], "yolo")

    @patch("src.api.endpoints.inference_workers.inference_worker_manager.get_worker_stats")
    @patch("src.api.endpoints.inference_workers.inference_worker_manager.start_worker")
    @patch("src.api.endpoints.inference_workers.inference_runtime_service.get")
    def test_start_worker_enables_detection_and_starts_worker(self, runtime_get_mock, start_worker_mock, stats_mock):
        # Arrange
        stream = self._seed_stream(metadata={})
        runtime_get_mock.return_value = object()
        stats_mock.return_value = {"stream_id": stream.id, "running": True}

        # Act
        response = self.client.post(f"/api/v1/inference-workers/{stream.id}/start")

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["worker"]["running"], True)
        stored = self._reload_stream(stream.id)
        self.assertTrue(stored.stream_metadata["detection_enabled"])
        start_worker_mock.assert_called_once()

    @patch("src.api.endpoints.inference_workers.inference_worker_manager.get_worker_stats")
    @patch("src.api.endpoints.inference_workers.inference_worker_manager.restart_worker")
    @patch("src.api.endpoints.inference_workers.inference_runtime_service.get")
    def test_patch_worker_config_persists_overrides_and_restarts(
        self,
        runtime_get_mock,
        restart_worker_mock,
        stats_mock,
    ):
        # Arrange
        stream = self._seed_stream(metadata={})
        runtime_get_mock.return_value = object()
        stats_mock.return_value = {"stream_id": stream.id, "runtime": "onnxruntime", "running": True}

        # Act
        response = self.client.patch(
            f"/api/v1/inference-workers/{stream.id}/config",
            json={
                "model_name": "yolo11n",
                "runtime": "onnxruntime",
                "dtype": "fp16",
                "providers": ["CUDAExecutionProvider"],
                "confidence": 0.6,
                "classes": [0, 1],
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        stored = self._reload_stream(stream.id)
        self.assertEqual(stored.stream_metadata["detection_model"], "yolo11n")
        self.assertEqual(stored.stream_metadata["detection_runtime"], "onnxruntime")
        self.assertEqual(stored.stream_metadata["detection_dtype"], "fp16")
        self.assertEqual(stored.stream_metadata["detection_providers"], ["CUDAExecutionProvider"])
        self.assertEqual(stored.stream_metadata["detection_confidence"], 0.6)
        self.assertEqual(stored.stream_metadata["detection_classes"], [0, 1])
        self.assertTrue(stored.stream_metadata["detection_enabled"])
        restart_worker_mock.assert_called_once()

    @patch("src.api.endpoints.inference_workers.inference_worker_manager.warmup_worker")
    def test_warmup_worker_returns_metrics(self, warmup_mock):
        # Arrange
        warmup_mock.return_value = {"iterations": 3, "avg_inference_ms": 5.0}

        # Act
        response = self.client.post("/api/v1/inference-workers/10/warmup", json={"iterations": 3})

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["warmup"]["avg_inference_ms"], 5.0)
        warmup_mock.assert_called_once_with(10, 3)

    @patch("src.api.endpoints.inference_workers.inference_worker_manager.restart_all")
    @patch("src.api.endpoints.inference_workers.inference_runtime_service.get")
    def test_restart_all_only_uses_active_streams(self, runtime_get_mock, restart_all_mock):
        # Arrange
        active_stream = self._seed_stream(status="active")
        self._seed_stream(status="stopped")
        runtime_get_mock.return_value = object()
        restart_all_mock.return_value = 1

        # Act
        response = self.client.post("/api/v1/inference-workers/actions/restart-all")

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["restarted_workers"], 1)
        active_streams = restart_all_mock.call_args.args[0]
        self.assertEqual([stream.id for stream in active_streams], [active_stream.id])
