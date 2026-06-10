from pydantic import BaseModel
from pydantic import Field


class RuntimeVariant(BaseModel):
    id: str
    label: str
    available: bool
    reason: str | None = None


class RuntimeOption(BaseModel):
    id: str
    label: str
    runtime_type: str = Field(default="vision")
    available: bool
    reason: str | None = None
    supported_devices: list[str] = Field(default_factory=list)
    supported_dtypes: list[str] = Field(default_factory=list)
    providers: list[str] = Field(default_factory=list)
    variants: list[RuntimeVariant] = Field(default_factory=list)


class RuntimeCatalog(BaseModel):
    options: list[RuntimeOption]
    recommended_runtime: str
