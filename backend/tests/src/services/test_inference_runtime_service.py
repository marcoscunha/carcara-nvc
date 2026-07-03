from src.ml.base import HardwareAccelerator
from src.services.inference_runtime import InferenceRuntimeService


def _fake_policy():
    return type(
        "Policy",
        (),
        {
            "profile": "generic",
            "selected_preprocess_mode": "python",
            "selected_postprocess_mode": "python",
            "selected_annotate_mode": "cpu",
            "selected_encoder_mode": "x264",
        },
    )()


def test_runtime_service_update_round_trips_runtime_dtype_and_providers(monkeypatch):
    # Arrange
    monkeypatch.setattr(
        "src.services.inference_runtime.list_available_runtime_ids",
        lambda: ["yolo", "onnxruntime", "tensorrt"],
    )
    monkeypatch.setattr(
        "src.services.inference_runtime.HardwareDetector.detect_all",
        lambda: {HardwareAccelerator.CPU: True, HardwareAccelerator.CUDA: True},
    )
    monkeypatch.setattr(
        InferenceRuntimeService,
        "_resolve_acceleration_policy",
        staticmethod(lambda refresh_capabilities=False: _fake_policy()),
    )
    monkeypatch.setattr("src.services.inference_runtime._resolve_default_accelerator", lambda: HardwareAccelerator.CPU)

    service = InferenceRuntimeService()

    # Act
    updated = service.update(
        model_name="yolo11n",
        accelerator="cuda",
        task_type="pose",
        runtime="onnxruntime",
        dtype="fp16",
        providers=["CUDAExecutionProvider", "", "CPUExecutionProvider"],
    )

    # Assert
    assert updated.model_name == "yolo11n"
    assert updated.accelerator == HardwareAccelerator.CUDA
    assert updated.task_type == "pose"
    assert updated.runtime == "onnxruntime"
    assert updated.dtype == "fp16"
    assert updated.providers == ["CUDAExecutionProvider", "CPUExecutionProvider"]

    current = service.get()
    assert current.runtime == "onnxruntime"
    assert current.dtype == "fp16"
    assert current.providers == ["CUDAExecutionProvider", "CPUExecutionProvider"]


def test_runtime_service_rejects_unsupported_runtime(monkeypatch):
    # Arrange
    monkeypatch.setattr("src.services.inference_runtime.list_available_runtime_ids", lambda: ["yolo"])
    monkeypatch.setattr(
        InferenceRuntimeService,
        "_resolve_acceleration_policy",
        staticmethod(lambda refresh_capabilities=False: _fake_policy()),
    )
    monkeypatch.setattr("src.services.inference_runtime._resolve_default_accelerator", lambda: HardwareAccelerator.CPU)
    service = InferenceRuntimeService()

    # Act
    try:
        service.update(runtime="onnxruntime")
    except ValueError as exc:
        # Assert
        assert str(exc) == "Unsupported runtime: onnxruntime"
    else:
        raise AssertionError("Expected unsupported runtime to raise ValueError")
