#!/usr/bin/env bash
# exit on error
set -o errexit

echo "========================================="
echo "Building Deadlock for Render Deployment"
echo "========================================="

echo "==> Step 1: Upgrading pip..."
pip install --upgrade pip

echo "==> Step 2: Installing Python backend dependencies..."
pip install -r requirements.txt

echo "==> Step 3: Installing Node packages and Building Vite Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "==> Step 4: Pre-generating acoustic scenario samples..."
python -c "from backend.sample_audio_generator import generate_sample_audio_files; generate_sample_audio_files('./sample_audios')"

echo "========================================="
echo "Deadlock Build Completed Successfully!"
echo "========================================="
