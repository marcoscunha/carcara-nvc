# include fast api
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import time

from .core.config import settings
from .core.logging import setup_logging
from .db.session import get_db
from .db.init_db import init_db
from .models import camera, stream, detection, alarm, roi
from .services.detection import ObjectDetectionService
from .api.endpoints import cameras, streams, detections, models, alarms, roi as roi_endpoints

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Initialize database
init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(
        f"Request: {request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Time: {process_time:.2f}s"
    )
    return response

# Error handling middleware
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error handler caught: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
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
    logger.info("Root endpoint accessed")
    return {
        "message": "Welcome to Carcara NVC Backend",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

@app.on_event("startup")
async def startup_event():
    logger.info("Application starting up...")
    logger.info(f"Environment: {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"Database URI: {settings.SQLALCHEMY_DATABASE_URI}")
    logger.info(f"Using GPU: {settings.USE_GPU}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutting down...")
