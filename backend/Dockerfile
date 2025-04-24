# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    netcat-traditional \
    dos2unix \
    v4l-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml poetry.lock* ./

# Install Python dependencies
RUN pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    poetry config installer.max-workers 10 && \
    poetry install --only main --no-root --no-interaction

# Copy application code
COPY . .

# Fix line endings and make scripts executable
RUN dos2unix scripts/migrate.sh scripts/start.sh && \
    chmod +x scripts/migrate.sh scripts/start.sh && \
    chown -R root:root /app

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Install only the necessary system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    netcat-traditional \
    v4l-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code and scripts
COPY --from=builder /app /app

# Create scripts directory if it doesn't exist
RUN mkdir -p /app/scripts

# Set proper permissions for all scripts
RUN chmod -R +x /app/scripts && \
    chown -R root:root /app

# Clean up Python cache
RUN find /usr/local/lib/python3.11/site-packages -type d -name "__pycache__" -exec rm -r {} + && \
    find /usr/local/lib/python3.11/site-packages -type d -name "*.dist-info" -exec rm -r {} + && \
    find /usr/local/lib/python3.11/site-packages -type d -name "*.egg-info" -exec rm -r {} + && \
    find /usr/local/lib/python3.11/site-packages -type f -name "*.pyc" -delete && \
    find /usr/local/lib/python3.11/site-packages -type f -name "*.pyo" -delete

# Add application directory to PYTHONPATH
ENV PYTHONPATH=/app

# Run migrations and start the application
CMD ["/bin/bash", "./scripts/start.sh"]
