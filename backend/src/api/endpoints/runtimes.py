from fastapi import APIRouter

from ...schemas.runtime import RuntimeCatalog
from ...services.runtime_catalog import list_runtimes

router = APIRouter()


@router.get("/", response_model=RuntimeCatalog)
def get_runtime_catalog() -> RuntimeCatalog:
    return list_runtimes()


@router.get("/recommended", response_model=dict[str, str])
def get_recommended_runtime() -> dict[str, str]:
    catalog = list_runtimes()
    return {"recommended_runtime": catalog.recommended_runtime}
