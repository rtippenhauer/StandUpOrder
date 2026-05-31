# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline 2>/dev/null || npm install
COPY frontend/ .
RUN npm run build


# ── Stage 2: Python runtime ───────────────────────────────────────────────────
FROM python:3.12-slim

# Install gosu for PUID/PGID support (standard Unraid pattern)
RUN apt-get update && apt-get install -y --no-install-recommends gosu && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /build/dist ./frontend/dist

# Entrypoint script (handles PUID/PGID)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory
RUN mkdir -p /data && chmod 777 /data

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["python", "-u", "backend/main.py"]
