from src.ml.base import HardwareAccelerator
from src.services import runtime_catalog


def test_list_runtimes_prefers_tensorrt_when_available(monkeypatch):
    monkeypatch.setattr(
        runtime_catalog,
        "_detect_hardware",
        lambda: {
            HardwareAccelerator.CPU: True,
            HardwareAccelerator.CUDA: True,
            HardwareAccelerator.TENSORRT: True,
        },
    )
    monkeypatch.setattr(
        runtime_catalog, "_module_available", lambda name: name in {"ultralytics", "torch", "onnxruntime", "tensorrt"}
    )
    monkeypatch.setattr(runtime_catalog, "_onnx_providers", lambda: ["CUDAExecutionProvider", "CPUExecutionProvider"])
    monkeypatch.setattr(runtime_catalog, "torch", None, raising=False)

    class _Cuda:
        @staticmethod
        def is_available():
            return True

    monkeypatch.setattr(runtime_catalog, "_support_torch_cuda", lambda: runtime_catalog.RuntimeSupport(True))

    catalog = runtime_catalog.list_runtimes()

    assert catalog.recommended_runtime == "tensorrt"
    assert [item.id for item in catalog.options] == ["yolo", "onnxruntime", "tensorrt"]
    assert catalog.options[0].variants[1].available is True
    assert catalog.options[1].providers == ["CUDAExecutionProvider", "CPUExecutionProvider"]


def test_list_runtimes_marks_tensorrt_unavailable_without_nvidia(monkeypatch):
    monkeypatch.setattr(runtime_catalog, "_detect_hardware", lambda: {HardwareAccelerator.CPU: True})
    monkeypatch.setattr(runtime_catalog, "_module_available", lambda name: name in {"ultralytics", "torch"})
    monkeypatch.setattr(
        runtime_catalog,
        "_support_torch_cuda",
        lambda: runtime_catalog.RuntimeSupport(False, "CUDA is not available in this environment"),
    )
    monkeypatch.setattr(runtime_catalog, "_onnx_providers", lambda: [])

    catalog = runtime_catalog.list_runtimes()
    tensorrt = next(item for item in catalog.options if item.id == "tensorrt")
    onnxruntime = next(item for item in catalog.options if item.id == "onnxruntime")

    assert catalog.recommended_runtime == "yolo"
    assert tensorrt.available is False
    assert tensorrt.reason == "No NVIDIA CUDA/Jetson hardware detected"
    assert onnxruntime.available is False
    assert onnxruntime.reason == "Package 'onnxruntime' is not installed"
