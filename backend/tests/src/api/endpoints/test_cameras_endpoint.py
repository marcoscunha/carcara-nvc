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


def _identity(device_path, serial):
    return {
        "device_id": None,
        "device_path": device_path,
        "physical_address": None,
        "usb_vendor_id": "046d",
        "usb_product_id": "0825",
        "usb_serial_number": serial,
    }


class CamerasEndpointCollisionTests(TestCase):
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
        super().setUpClass()

    @classmethod
    def tearDownClass(cls) -> None:
        Base.metadata.drop_all(bind=cls.engine)
        app.dependency_overrides.clear()
        auth_settings.AUTH_ENABLED = cls._previous_auth_enabled
        cls.client = None
        super().tearDownClass()

    def tearDown(self) -> None:
        db = self.TestingSessionLocal()
        try:
            db.query(Camera).delete()
            db.commit()
        finally:
            db.close()
        super().tearDown()

    def _add_camera(self, name, device_path, serial):
        db = self.TestingSessionLocal()
        try:
            camera = Camera(name=name, camera_type="local", **_identity(device_path, serial))
            db.add(camera)
            db.commit()
            db.refresh(camera)
            return camera.id
        finally:
            db.close()

    def test_update_does_not_rebind_camera_onto_another_cameras_device(self):
        cam_a = self._add_camera("Cam A", "/dev/v4l/by-id/usb-a", "SER-A")
        self._add_camera("Cam B", "/dev/v4l/by-id/usb-b", "SER-B")

        # Simulate a resolution that would (wrongly) hand Cam A the device that
        # already belongs to Cam B.
        with patch(
            "src.api.endpoints.cameras.CameraService.resolve_local_camera",
            return_value=_identity("/dev/v4l/by-id/usb-b", "SER-B"),
        ):
            resp = self.client.put(f"/api/v1/cameras/{cam_a}", json={"name": "Cam A renamed"})

        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        # Cam A must keep its own device identity, not Cam B's.
        self.assertEqual(body["device_path"], "/dev/v4l/by-id/usb-a")
        self.assertEqual(body["usb_serial_number"], "SER-A")

    def test_create_rejects_device_already_registered(self):
        self._add_camera("Cam B", "/dev/v4l/by-id/usb-b", "SER-B")

        payload = {
            "name": "Duplicate",
            "camera_type": "local",
            "device_path": "/dev/v4l/by-id/usb-b",
            "usb_serial_number": "SER-B",
        }
        resp = self.client.post("/api/v1/cameras/", json=payload)

        self.assertEqual(resp.status_code, 409, resp.text)
