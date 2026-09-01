#!/usr/bin/env bash
# exit on error
set -o errexit

echo "========================================="
echo "Building Deadlock for Render Deployment"
echo "========================================="

echo "==> Step 1: Upgrading pip and build tools..."
pip install --upgrade pip setuptools wheel

echo "==> Step 2: Installing lightweight CPU PyTorch..."
pip install torch --index-url https://download.pytorch.org/whl/cpu

echo "==> Step 3: Installing Python backend requirements..."
pip install -r requirements.txt

echo "==> Step 4: Installing Node packages and Building Vite Frontend..."
cd frontend
npm install --include=dev
npm run build
cd ..

echo "==> Step 5: Pre-generating acoustic scenario samples..."
python -c "from backend.sample_audio_generator import generate_sample_audio_files; generate_sample_audio_files('./sample_audios')"

echo "========================================="
echo "Deadlock Build Completed Successfully!"
echo "========================================="
