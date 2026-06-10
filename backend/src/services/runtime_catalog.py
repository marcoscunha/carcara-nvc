"""Hardware-aware runtime catalog for inference runtime selection."""

from __future__ import annotations

import importlib
from dataclasses import dataclass

from ..ml.accelerators.detector import HardwareDetector
from ..ml.base import HardwareAccelerator
from ..schemas.runtime import RuntimeCatalog
from ..schemas.runtime import RuntimeOption
from ..schemas.runtime import RuntimeVariant


@dataclass
class RuntimeSupport:
    available: bool
    reason: str | None = None


def _module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def _detect_hardware() -> dict[HardwareAccelerator, bool]:
    try:
        return HardwareDetector.detect_all()
    except Exception:
        return {HardwareAccelerator.CPU: True}


def _support_ultralytics() -> RuntimeSupport:
    if not _module_available("ultralytics"):
        return RuntimeSupport(False, "Package 'ultralytics' is not installed")
    return RuntimeSupport(True)


def _support_torch_cuda() -> RuntimeSupport:
    if not _module_available("torch"):
        return RuntimeSupport(False, "Package 'torch' is not installed")

    try:
        import torch  # type: ignore

        if not torch.cuda.is_available():
            return RuntimeSupport(False, "CUDA is not available in this environment")
        return RuntimeSupport(True)
    except Exception as exc:
        return RuntimeSupport(False, f"PyTorch CUDA check failed: {exc}")


def _support_onnxruntime() -> RuntimeSupport:
    if not _module_available("onnxruntime"):
        return RuntimeSupport(False, "Package 'onnxruntime' is not installed")
    return RuntimeSupport(True)


def _support_tensorrt(available_hw: dict[HardwareAccelerator, bool]) -> RuntimeSupport:
    has_nvidia = bool(
        available_hw.get(HardwareAccelerator.CUDA, False)
        or available_hw.get(HardwareAccelerator.JETSON, False)
        or available_hw.get(HardwareAccelerator.TENSORRT, False)
    )
    if not has_nvidia:
        return RuntimeSupport(False, "No NVIDIA CUDA/Jetson hardware detected")

    if not _module_available("tensorrt"):
        return RuntimeSupport(False, "Package 'tensorrt' is not installed")

    return RuntimeSupport(True)


def _onnx_providers() -> list[str]:
    if not _module_available("onnxruntime"):
        return []

    try:
        import onnxruntime as ort  # type: ignore

        return list(ort.get_available_providers())
    except Exception:
        return []


def _vision_runtime_options() -> list[RuntimeOption]:
    available_hw = _detect_hardware()

    ultralytics_support = _support_ultralytics()
    pytorch_cuda_support = _support_torch_cuda()
    onnx_support = _support_onnxruntime()
    tensorrt_support = _support_tensorrt(available_hw)
    ort_providers = _onnx_providers()

    yolo_devices = ["cpu"]
    if available_hw.get(HardwareAccelerator.CUDA, False):
        yolo_devices.append("cuda")
    if available_hw.get(HardwareAccelerator.JETSON, False):
        yolo_devices.append("jetson")

    options = [
        RuntimeOption(
            id="yolo",
            label="Ultralytics (PyTorch)",
            runtime_type="vision",
            available=ultralytics_support.available,
            reason=ultralytics_support.reason,
            supported_devices=yolo_devices,
            supported_dtypes=["auto", "fp32", "fp16"],
            providers=[],
            variants=[
                RuntimeVariant(
                    id="pytorch",
                    label="PyTorch (CPU)",
                    available=ultralytics_support.available,
                    reason=ultralytics_support.reason,
                ),
                RuntimeVariant(
                    id="pytorch_cuda",
                    label="PyTorch + CUDA",
                    available=ultralytics_support.available and pytorch_cuda_support.available,
                    reason=pytorch_cuda_support.reason,
                ),
            ],
        ),
        RuntimeOption(
            id="onnxruntime",
            label="ONNX Runtime",
            runtime_type="vision",
            available=onnx_support.available,
            reason=onnx_support.reason,
            supported_devices=["cpu", "cuda", "tensorrt"],
            supported_dtypes=["auto", "fp32", "fp16", "int8"],
            providers=ort_providers,
            variants=[],
        ),
        RuntimeOption(
            id="tensorrt",
            label="TensorRT",
            runtime_type="vision",
            available=tensorrt_support.available,
            reason=tensorrt_support.reason,
            supported_devices=["cuda", "jetson"],
            supported_dtypes=["auto", "fp16", "int8"],
            providers=[],
            variants=[],
        ),
    ]

    return options


def list_runtimes() -> RuntimeCatalog:
    options = _vision_runtime_options()
    recommended = "yolo"

    if any(item.id == "tensorrt" and item.available for item in options):
        recommended = "tensorrt"
    elif any(item.id == "onnxruntime" and item.available for item in options):
        recommended = "onnxruntime"

    return RuntimeCatalog(options=options, recommended_runtime=recommended)


def list_available_runtime_ids() -> list[str]:
    catalog = list_runtimes()
    return [item.id for item in catalog.options if item.available]
