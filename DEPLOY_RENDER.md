# Deploying Deadlock to Render (Render.com)

Deadlock is fully configured for **1-click single-service full-stack deployment** on [Render.com](https://render.com). Both the Apple-styled React frontend SPA, the 4-stage AI voice cloning defense pipeline, and the real-time WebSockets are served from a single unified service.

---

## 🚀 Quick Deployment (Blueprint Method — Recommended)

### Step 1: Push Code to GitHub
Ensure all repository files (including `render.yaml`, `build.sh`, `requirements.txt`, `backend/`, and `frontend/`) are pushed to your GitHub repository:

```bash
git add .
git commit -m "Configure Deadlock for Render deployment"
git push origin main
```

---

### Step 2: Deploy on Render
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in.
2. Click **New +** in the top navigation and select **Blueprint**.
3. Connect your GitHub account and select your **`deadlock`** repository.
4. Render will automatically detect [`render.yaml`](file:///c:/Users/mallareddy/Desktop/sih/render.yaml).
5. Click **Apply**.

Render will automatically:
- Install Python requirements (`fastapi`, `torch`, `librosa`, `scipy`, etc.).
- Install Node dependencies and compile the Apple-styled React frontend into `frontend/dist`.
- Pre-generate acoustic scenario audio files.
- Launch the Uvicorn web server on `$PORT`.

Your live application will be available at:  
`https://deadlock-voice-defense.onrender.com` (or your custom Render URL).

---

## 🛠️ Manual Web Service Deployment (Alternative)

If you prefer setting up a manual **Web Service** on Render:

1. In Render Dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name:** `deadlock-voice-defense`
   - **Language / Runtime:** `Python 3`
   - **Region:** `Oregon (US West)` or nearest region
   - **Branch:** `main`
   - **Build Command:** `./build.sh`  
     *(or: `pip install -r requirements.txt && cd frontend && npm install && npm run build && cd .. && python -c "from backend.sample_audio_generator import generate_sample_audio_files; generate_sample_audio_files('./sample_audios')"`)*
   - **Start Command:** `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** `Free`
4. In **Environment Variables**, add:
   - `PYTHON_VERSION`: `3.11.9`
   - `PORT`: `10000`
5. Click **Create Web Service**.

---

## 🐳 Docker Deployment (Alternative)

Deadlock also includes a multi-stage production [`Dockerfile`](file:///c:/Users/mallareddy/Desktop/sih/Dockerfile):

1. In Render Dashboard, click **New +** → **Web Service**.
2. Select **Docker** as the environment.
3. Click **Create Web Service**.

---

## 🔍 Verification After Deployment

Once the Render build is live, you can test all endpoints directly:
- **Web App Dashboard:** `https://<your-render-subdomain>.onrender.com/`
- **Swagger REST API Docs:** `https://<your-render-subdomain>.onrender.com/docs`
- **System Health Status:** `https://<your-render-subdomain>.onrender.com/api/status`
- **Cryptographic Audit Ledger Proof:** `https://<your-render-subdomain>.onrender.com/api/blockchain/verify`
- **Live WebSocket Inference Stream:** `wss://<your-render-subdomain>.onrender.com/ws/live-call`
