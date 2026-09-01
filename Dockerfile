# Stage 1: Build the React SPA Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend + SPA Server
FROM python:3.11-slim
WORKDIR /app

# Install system audio dependencies for librosa and soundfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend dist from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Pre-generate sample audios
RUN python -c "from backend.sample_audio_generator import generate_sample_audio_files; generate_sample_audio_files('./sample_audios')"

EXPOSE 10000

ENV PORT=10000
CMD ["sh", "-c", "python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
