from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.core.security.oauth2 import settings as auth_settings
from src.db.base_class import Base
from src.main import app
from src.models.camera import Camera
from src.models.stream import Stream


class InferenceRuntimeEndpointTests(TestCase):
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

        cls._session_local_patcher = patch(
            "src.api.endpoints.inference_runtime.SessionLocal",
            cls.TestingSessionLocal,
        )
        cls._session_local_patcher.start()
        cls.client = TestClient(app)
        cls.db = cls.TestingSessionLocal()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.db.close()
        cls._session_local_patcher.stop()
        Base.metadata.drop_all(bind=cls.engine)
        auth_settings.AUTH_ENABLED = cls._previous_auth_enabled
        cls.client = None
        cls.db = None
        super().tearDownClass()

    def tearDown(self) -> None:
        self.db.query(Stream).delete()
        self.db.query(Camera).delete()
        self.db.commit()
        super().tearDown()

    def _seed_stream(self, metadata: dict | None = None) -> Stream:
        suffix = self.db.query(Stream).count() + 1
        camera = Camera(name="Camera 1", camera_type="local", device_id=1)
        self.db.add(camera)
        self.db.commit()
        stream = Stream(
            camera_id=camera.id,
            stream_name=f"camera_{camera.id}_stream_{suffix}",
            status="active",
            stream_metadata=metadata or {},
        )
        self.db.add(stream)
        self.db.commit()
        self.db.refresh(stream)
        return stream

    @patch("src.api.endpoints.inference_runtime.inference_worker_manager.count_running_workers_using_global_defaults")
    @patch("src.api.endpoints.inference_runtime.inference_worker_manager.get_running_stream_ids")
    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.list_available_runtimes")
    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.list_available_accelerators")
    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.list_available_models")
    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.get")
    def test_get_runtime_config_includes_affected_worker_count(
        self,
        get_mock,
        models_mock,
        accelerators_mock,
        runtimes_mock,
        running_ids_mock,
        affected_mock,
    ):
        # Arrange
        stream = self._seed_stream()
        get_mock.return_value = type(
            "Config",
            (),
            {
                "model_name": "yolo11n",
                "accelerator": type("Acc", (), {"value": "cpu"})(),
                "task_type": "detect",
                "runtime": "auto",
                "dtype": "auto",
                "providers": None,
                "acceleration_profile": "generic",
                "accel_preprocess_mode": "python",
                "accel_postprocess_mode": "python",
                "accel_annotate_mode": "cpu",
                "accel_encoder_mode": "x264",
            },
        )()
        models_mock.return_value = ["yolo11n"]
        accelerators_mock.return_value = ["cpu"]
        runtimes_mock.return_value = ["yolo", "onnxruntime"]
        running_ids_mock.return_value = [stream.id]
        affected_mock.return_value = 1

        # Act
        response = self.client.get("/api/v1/inference-runtime/")

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["affected_running_workers"], 1)
        self.assertEqual(response.json()["available_runtimes"], ["yolo", "onnxruntime"])

    @patch("src.api.endpoints.inference_runtime.inference_worker_manager.restart_worker")
    @patch("src.api.endpoints.inference_runtime.inference_worker_manager.count_running_workers_using_global_defaults")
    @patch("src.api.endpoints.inference_runtime.inference_worker_manager.get_running_stream_ids")
    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.list_available_runtimes")
    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.list_available_accelerators")
    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.list_available_models")
    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.update")
    def test_update_runtime_restarts_only_workers_without_stream_override(
        self,
        update_mock,
        models_mock,
        accelerators_mock,
        runtimes_mock,
        running_ids_mock,
        affected_mock,
        restart_worker_mock,
    ):
        # Arrange
        inherited = self._seed_stream(metadata={})
        overridden = self._seed_stream(metadata={"detection_runtime": "yolo"})

        updated = type(
            "Config",
            (),
            {
                "model_name": "yolo11n",
                "accelerator": type("Acc", (), {"value": "cuda"})(),
                "task_type": "detect",
                "runtime": "onnxruntime",
                "dtype": "fp16",
                "providers": ["CUDAExecutionProvider"],
                "acceleration_profile": "gpu",
                "accel_preprocess_mode": "cuda",
                "accel_postprocess_mode": "cuda",
                "accel_annotate_mode": "cpu",
                "accel_encoder_mode": "nvenc",
            },
        )()
        update_mock.return_value = updated
        models_mock.return_value = ["yolo11n"]
        accelerators_mock.return_value = ["cpu", "cuda"]
        runtimes_mock.return_value = ["yolo", "onnxruntime"]
        running_ids_mock.return_value = [inherited.id, overridden.id]
        affected_mock.return_value = 1

        # Act
        response = self.client.put(
            "/api/v1/inference-runtime/",
            json={
                "runtime": "onnxruntime",
                "dtype": "fp16",
                "providers": ["CUDAExecutionProvider"],
                "apply_to_running": True,
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["restarted_workers"], 1)
        restart_worker_mock.assert_called_once()
        restarted_stream = restart_worker_mock.call_args.args[0]
        self.assertEqual(restarted_stream.id, inherited.id)
        self.assertEqual(restart_worker_mock.call_args.kwargs["runtime"], updated)

    @patch("src.api.endpoints.inference_runtime.inference_runtime_service.update")
    def test_update_runtime_returns_400_on_invalid_runtime(self, update_mock):
        # Arrange
        update_mock.side_effect = ValueError("Unsupported runtime: invalid")

        # Act
        response = self.client.put("/api/v1/inference-runtime/", json={"runtime": "invalid"})

        # Assert
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Unsupported runtime: invalid")
