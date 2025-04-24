# include fast api
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from .core.config import settings
from .db.session import get_db
from .db.init_db import init_db
from .models import camera, stream, detection, alarm, roi
from .services.detection import ObjectDetectionService
from .api.endpoints import cameras, streams, detections, models, alarms, roi as roi_endpoints

# Initialize database
init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    cameras.router,
    prefix=f"{settings.API_V1_STR}/cameras",
    tags=["cameras"]
)
app.include_router(
    streams.router,
    prefix=f"{settings.API_V1_STR}/streams",
    tags=["streams"]
)
app.include_router(
    detections.router,
    prefix=f"{settings.API_V1_STR}/detections",
    tags=["detections"]
)
app.include_router(
    models.router,
    prefix=f"{settings.API_V1_STR}/models",
    tags=["models"]
)
app.include_router(
    alarms.router,
    prefix=f"{settings.API_V1_STR}/alarms",
    tags=["alarms"]
)
app.include_router(
    roi_endpoints.router,
    prefix=f"{settings.API_V1_STR}/roi",
    tags=["roi"]
)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Carcara NVC Backend",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }
