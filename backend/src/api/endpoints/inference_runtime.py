from fastapi import APIRouter
from fastapi import HTTPException

from ...api.models.inference_runtime import InferenceRuntimeConfigResponse
from ...api.models.inference_runtime import InferenceRuntimeConfigUpdate
from ...db.session import SessionLocal
from ...models.stream import Stream
from ...services.inference_runtime import inference_runtime_service
from ...services.inference_worker_manager import inference_worker_manager

router = APIRouter()


@router.get("/", response_model=InferenceRuntimeConfigResponse)
def get_inference_runtime_config() -> InferenceRuntimeConfigResponse:
    config = inference_runtime_service.get()
    db = SessionLocal()
    try:
        running_ids = set(inference_worker_manager.get_running_stream_ids())
        if running_ids:
            streams = db.query(Stream).filter(Stream.id.in_(running_ids)).all()
            affected_running_workers = inference_worker_manager.count_running_workers_using_global_defaults(streams)
        else:
            affected_running_workers = 0
    finally:
        db.close()

    return InferenceRuntimeConfigResponse(
        model_name=config.model_name,
        accelerator=config.accelerator.value,
        task_type=config.task_type,
        runtime=config.runtime,
        dtype=config.dtype,
        providers=config.providers or [],
        acceleration_profile=config.acceleration_profile,
        accel_preprocess_mode=config.accel_preprocess_mode,
        accel_postprocess_mode=config.accel_postprocess_mode,
        accel_annotate_mode=config.accel_annotate_mode,
        accel_encoder_mode=config.accel_encoder_mode,
        available_models=inference_runtime_service.list_available_models(),
        available_accelerators=inference_runtime_service.list_available_accelerators(),
        available_runtimes=inference_runtime_service.list_available_runtimes(),
        affected_running_workers=affected_running_workers,
        restarted_workers=0,
    )


@router.put("/", response_model=InferenceRuntimeConfigResponse)
def update_inference_runtime_config(payload: InferenceRuntimeConfigUpdate) -> InferenceRuntimeConfigResponse:
    try:
        updated = inference_runtime_service.update(
            model_name=payload.model_name,
            accelerator=payload.accelerator,
            task_type=payload.task_type,
            runtime=payload.runtime,
            dtype=payload.dtype,
            providers=payload.providers,
            refresh_capabilities=payload.refresh_capabilities,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    restarted_workers = 0
    affected_running_workers = 0
    db = SessionLocal()
    try:
        running_ids = set(inference_worker_manager.get_running_stream_ids())
        if running_ids:
            streams = db.query(Stream).filter(Stream.id.in_(running_ids)).all()
            affected_running_workers = inference_worker_manager.count_running_workers_using_global_defaults(streams)

            if payload.apply_to_running:
                for stream in streams:
                    metadata = stream.stream_metadata or {}
                    if any(
                        key in metadata
                        for key in (
                            "detection_runtime",
                            "detection_dtype",
                            "detection_providers",
                        )
                    ):
                        continue

                    inference_worker_manager.restart_worker(stream, runtime=updated)
                    restarted_workers += 1
    finally:
        db.close()

    return InferenceRuntimeConfigResponse(
        model_name=updated.model_name,
        accelerator=updated.accelerator.value,
        task_type=updated.task_type,
        runtime=updated.runtime,
        dtype=updated.dtype,
        providers=updated.providers or [],
        acceleration_profile=updated.acceleration_profile,
        accel_preprocess_mode=updated.accel_preprocess_mode,
        accel_postprocess_mode=updated.accel_postprocess_mode,
        accel_annotate_mode=updated.accel_annotate_mode,
        accel_encoder_mode=updated.accel_encoder_mode,
        available_models=inference_runtime_service.list_available_models(),
        available_accelerators=inference_runtime_service.list_available_accelerators(),
        available_runtimes=inference_runtime_service.list_available_runtimes(),
        affected_running_workers=affected_running_workers,
        restarted_workers=restarted_workers,
    )
