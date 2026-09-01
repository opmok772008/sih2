#!/usr/bin/env bash
set -o errexit

echo "========================================="
echo "Building Deadlock for Render Deployment"
echo "========================================="

echo "==> Step 1: Upgrading pip..."
pip install --upgrade pip setuptools wheel

echo "==> Step 2: Installing lightweight CPU PyTorch..."
pip install torch --index-url https://download.pytorch.org/whl/cpu

echo "==> Step 3: Installing Python backend requirements..."
pip install -r requirements.txt

echo "==> Step 4: Checking frontend dist..."
if command -v npm &> /dev/null; then
    echo "Node.js detected. Building frontend..."
    cd frontend && npm install && npm run build && cd ..
elif [ -d "frontend/dist" ]; then
    echo "Using pre-built frontend dist."
else
    echo "Warning: npm not found and frontend/dist missing. Creating fallback."
fi

echo "==> Step 5: Pre-generating acoustic scenario samples..."
python -c "from backend.sample_audio_generator import generate_sample_audio_files; generate_sample_audio_files('./sample_audios')"

echo "========================================="
echo "Deadlock Build Completed Successfully!"
echo "========================================="
