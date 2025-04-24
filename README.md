# Carcara NVC - IP Camera Streaming and Object Detection Backend

A robust backend system for receiving, storing, and processing IP camera streams with real-time object detection capabilities.

## Features

- IP Camera stream management
- Real-time object detection using YOLO models
- Support for multiple object detection models
- Hardware acceleration support (CPU/GPU)
- PostgreSQL database for data persistence
- RESTful API for easy integration
- Modern React frontend with Material-UI

## Prerequisites

- Docker Engine
- Docker Compose (included with Docker Desktop or install via `apt install docker-compose-plugin`)
- NVIDIA GPU (optional, for hardware acceleration)
- NVIDIA Container Toolkit (optional, for GPU support)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/carcara-nvc.git
cd carcara-nvc
```

2. Create a `.env` file in the root directory:
```bash
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=carcara_nvc

# GPU Support (optional)
USE_GPU=true
CUDA_VISIBLE_DEVICES=0
```

3. Start the services:
```bash
docker compose up -d
```

## Development

### Backend Development

1. Install Poetry:
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

2. Install dependencies:
```bash
cd backend
poetry install
```

3. Run the development server:
```bash
poetry run uvicorn src.main:app --reload
```

### Frontend Development

1. Install Node.js dependencies:
```bash
cd frontend
npm install
```

2. Run the development server:
```bash
npm run dev
```

## API Documentation

Once the services are running, you can access the API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Cameras
- `POST /api/v1/cameras/` - Create a new camera
- `GET /api/v1/cameras/` - List all cameras
- `GET /api/v1/cameras/{camera_id}` - Get camera details
- `PUT /api/v1/cameras/{camera_id}` - Update camera
- `DELETE /api/v1/cameras/{camera_id}` - Delete camera

### Streams
- `POST /api/v1/streams/` - Create a new stream
- `GET /api/v1/streams/` - List all streams
- `GET /api/v1/streams/{stream_id}` - Get stream details
- `PUT /api/v1/streams/{stream_id}` - Update stream
- `DELETE /api/v1/streams/{stream_id}` - Delete stream

### Detections
- `POST /api/v1/detections/` - Create a new detection
- `GET /api/v1/detections/` - List all detections
- `GET /api/v1/detections/{detection_id}` - Get detection details
- `DELETE /api/v1/detections/{detection_id}` - Delete detection

## Hardware Acceleration

The system supports both CPU and GPU-based object detection. To enable GPU support:

1. Install NVIDIA Container Toolkit:
```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt update && sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker
```

2. Set the environment variables in your `.env` file:
```bash
USE_GPU=true
CUDA_VISIBLE_DEVICES=0
```

## Docker Commands

### Start Services
```bash
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### View Logs
```bash
# All services
docker compose logs

# Specific service
docker compose logs backend
docker compose logs frontend
docker compose logs db
```

### Rebuild Services
```bash
# All services
docker compose build

# Specific service
docker compose build backend
docker compose build frontend
```

### Restart Services
```bash
# All services
docker compose restart

# Specific service
docker compose restart backend
docker compose restart frontend
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
