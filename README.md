# DEADLOCK — AI Voice Cloning & Impersonation Attack Detector
**Smart India Hackathon 2026** | **Problem Statement 26104**  
**Theme:** Blockchain & Cybersecurity  

![Deadlock Banner](https://img.shields.io/badge/SIH_2026-PS_26104-00f0ff?style=for-the-badge) ![Pipeline](https://img.shields.io/badge/Pipeline-4--Stage_Multi--Cue-10b981?style=for-the-badge) ![Theme](https://img.shields.io/badge/Theme-Blockchain_%26_Cybersecurity-8b5cf6?style=for-the-badge) ![Defense](https://img.shields.io/badge/Real--Time-WebSocket_Interceptor-ef4444?style=for-the-badge)

---

## 🎯 Executive Summary & Problem Statement
With the rapid proliferation of generative voice synthesis models (ElevenLabs, VALL-E, HiFi-GAN, diffusion vocoders), cybercriminals are increasingly executing real-time voice cloning and executive impersonation fraud targeting banking systems, corporate funds approvals, and critical biometric voice channels.

**Deadlock** is a real-time cybersecurity defence system that intercepts live and recorded telephonic/VOIP audio streams, detects AI synthetic speech artifacts, authenticates biometric voiceprints against enrolled vaults, executes multi-factor risk analysis (`ALLOW ACCESS` vs `BLOCK & ALERT`), and records immutable cryptographic verification blocks to an on-chain/tamper-evident audit ledger.

---

## 🏗️ 4-Stage Defense Pipeline Architecture

```
                                  [ Audio Stream / File Ingestion ]
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: Preprocessing & Multi-Band Feature Extraction                                           │
│ • 16 kHz Mono Resampling & Normalization                                                         │
│ • Energy-Based Voice Activity Detection (VAD) & Silence Trimming                                │
│ • Log Mel-Spectrogram (128 mel bins), LFCC (Linear Frequency Cepstral Coeffs)                   │
│ • MFCC (20 static + 20 delta + 20 delta-delta)                                                   │
│ • Pitch (F0) Tracking, Pitch Variance, Cycle Jitter (%) & Shimmer (%) Amplitude Perturbations    │
│ • Spectral Centroid, 85% Spectral Rolloff, and High-Frequency Band Energy Ratio (>4kHz)          │
└───────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
┌──────────────────────────────────────────────┐  ┌────────────────────────────────────────────────┐
│ STAGE 2: AI Deepfake & Spoof Detection       │  │ STAGE 3: Biometric Speaker Verification        │
│ • DeadlockNet PyTorch CNN-BiLSTM Classifier  │  │ • 256-Dimensional L2-Normalized Embedding     │
│ • Acoustic Forensic Heuristics:              │  │ • Multi-Order Cepstral & Mel Filterbank       │
│   - Neural Vocoder Upper-Band Cutoff (4kHz)  │  │ • Formant Dispersion & Glottal Resonance Space │
│   - Pitch Quantization & Monotonicity Deficit│  │ • High-Precision Cosine Similarity Matching   │
│   - Micro-Tremor & Laryngeal Jitter Deficit  │  │ • 8-Axis Acoustic Biometric Radar Profile      │
│ • Deepfake Confidence Score (0.0 to 1.0)     │  │ • Match Confidence & Biometric Grade           │
└──────────────────────┬───────────────────────┘  └───────────────────────┬────────────────────────┘
                       │                                                  │
                       └────────────────────────┬─────────────────────────┘
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: Multi-Factor Risk Engine & Decision Matrix                                              │
│ • Formula: Risk = 0.50 * P_fake + 0.35 * (1 - P_match) + 0.15 * Anomaly                         │
│ • Dynamic Security Decisions:                                                                    │
│   - ALLOW_ACCESS: Risk < 35% & Biometric Match >= 75% (Verified Human)                          │
│   - SUSPICIOUS_WARN: Risk 35%-65% (Step-Up Auth / Voice Challenge Phrase Required)               │
│   - BLOCK_AND_ALERT: Risk >= 65% or Deepfake >= 60% (Active Clone Attack Intercepted)           │
│ • Multi-Channel Alerts: Real-Time WebSocket, In-App Toast, Simulated SIEM Webhook Dispatch      │
│ • Blockchain Cryptographic Audit Ledger: SHA-256 Chained Blocks with HMAC Non-Repudiation        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⛓️ Blockchain & Cybersecurity Alignment
To address the **Blockchain & Cybersecurity** hackathon theme, Deadlock incorporates:
1. **Cryptographic Voiceprint Identity Tokens (VID)**: Enrolled voiceprints generate SHA-256 tokens linked to the user's biometric unit vector.
2. **Immutable Call Verification Ledger**: Every verification session seals an audit block containing `Session ID`, `Data Hash`, `Previous Block Hash`, and `HMAC-SHA256 Signature`.
3. **1-Click Ledger Integrity Verifier**: Allows security auditors to recalculate the full cryptographic hash chain across all blocks to mathematically prove 0 tampering.

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- Python 3.10+ (Tested and verified on Python 3.14 on Windows)
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# Navigate to workspace root
cd c:\Users\mallareddy\Desktop\sih

# Install Python backend dependencies
python -m pip install -r backend/requirements.txt

# Run Unit & Integration Test Suite (All 5 stages & blockchain verified)
python -m pytest backend/tests/test_pipeline.py -v

# Start FastAPI Backend Server on port 8000
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite Development Server on port 3000
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## 🎬 1-Click Evaluation Scenarios (Hackathon Demo)
The application includes 4 pre-loaded forensic test scenarios accessible under the **Forensic Audio Lab** tab:

| Scenario | Claimed Speaker | Description | Expected Decision |
| :--- | :--- | :--- | :--- |
| **Scenario A** | Alice Walker (CFO) | Genuine human voice with natural pitch inflection, physical micro-tremor, and rich upper formants. | `ALLOW_ACCESS` (Risk < 15%) |
| **Scenario B** | Alice Walker (CFO) | ElevenLabs AI Voice Clone mimicking Alice's vocal timbre with neural vocoder spectral artifacts. | `BLOCK_AND_ALERT` (Risk > 85%) |
| **Scenario C** | Alice Walker (CFO) | Bob (Unauthorized Human Impersonator) attempting social engineering voice fraud. | `SUSPICIOUS_WARN` (Biometric Mismatch) |
| **Scenario D** | Alice Walker (CFO) | Synthetic speech combined with telephony bandpass channel noise. | `BLOCK_AND_ALERT` (Vocoder Distortion) |

---

## 🎙️ Live Call Interceptor (Real-Time Mode)
- Click the **Live Call Interceptor** tab.
- Click **"START MIC STREAM"** to stream live microphone audio over WebSockets (`/ws/live-call`).
- Or click **"TEST CLONE ATTACK"** to simulate an incoming active phone call attack chunk-by-chunk and observe the real-time rolling risk gauge and alert interception trigger.

---

## 📁 Repository Structure
```
sih/
├── backend/
│   ├── main.py                     # FastAPI REST & WebSocket streaming server
│   ├── requirements.txt            # Python dependencies
│   ├── sample_audio_generator.py   # Test scenario audio synthesizer
│   ├── models/
│   │   └── database.py             # SQLite SQLAlchemy schema (Speakers, Calls, Blockchain)
│   ├── pipeline/
│   │   ├── stage1_preprocessing.py # 16kHz resample, VAD, Mel-Spec, LFCC, MFCC, Pitch
│   │   ├── stage2_deepfake_detector.py # DeadlockNet PyTorch CNN-BiLSTM + Forensic Heuristics
│   │   ├── stage3_speaker_verification.py # 256-D Biometric Voiceprint Cosine Matcher
│   │   ├── stage4_risk_engine.py   # Multi-Factor Risk Fusion & Decision Matrix
│   │   └── blockchain_ledger.py    # SHA-256 Chained Hash Ledger & HMAC Verifier
│   └── tests/
│       └── test_pipeline.py        # Automated test suite (100% pass)
├── frontend/
│   ├── index.html                  # HTML template with JetBrains Mono / Inter fonts
│   ├── vite.config.js              # Vite server & proxy configuration
│   ├── tailwind.config.js          # Cyber-Defense visual design system
│   ├── src/
│   │   ├── main.jsx                # React root
│   │   ├── App.jsx                 # Main application dashboard
│   │   ├── index.css               # Cyber glassmorphism & neon animations
│   │   └── components/
│   │       ├── Header.jsx          # Defense core status banner & navigation
│   │       ├── LiveCallInterceptor.jsx # Real-time mic stream & attack simulator
│   │       ├── ForensicAudioLab.jsx # 4-Stage deep dive inspector & 1-click test suite
│   │       ├── VoiceprintVault.jsx # Biometric identity enrollment & VID token generator
│   │       ├── BlockchainExplorer.jsx # SHA-256 block ledger & tamper verifier
│   │       ├── ThreatAnalytics.jsx # SIEM policies & security incident logs
│   │       ├── RiskGauge.jsx       # Futuristic HUD threat gauge
│   │       ├── WaveformVisualizer.jsx # HTML5 Canvas audio visualizer & scrubber
│   │       ├── RadarChart.jsx      # 8-axis acoustic biometric radar comparison
│   │       └── AlertToast.jsx      # High-priority cyber alert banner
└── README.md
```

## ☁️ Deploying to Render (Render.com)

Deadlock is fully configured for **1-click full-stack deployment** on Render via the included [`render.yaml`](file:///c:/Users/mallareddy/Desktop/sih/render.yaml) blueprint:

### 1-Click Blueprint Deployment
1. Push this repository to GitHub.
2. Open [dashboard.render.com](https://dashboard.render.com/) and click **New +** → **Blueprint**.
3. Select your repository and click **Apply**.

Render will automatically run [`build.sh`](file:///c:/Users/mallareddy/Desktop/sih/build.sh), compile the React SPA into `frontend/dist`, install Python ML dependencies, pre-generate acoustic scenarios, and launch the unified web server on `$PORT`.

See [DEPLOY_RENDER.md](file:///c:/Users/mallareddy/Desktop/sih/DEPLOY_RENDER.md) for full deployment documentation.

---

## 🛡️ Production Readiness vs Prototype Roadmap
- **Prototype Level**: SQLite database, in-process PyTorch model, simulated SIEM webhooks.
- **Production Roadmap**: PostgreSQL/Milvus vector database for 10M+ speaker embeddings, WebRTC VOIP gateway integration (SIP/RTP interception), hardware HSM key management for blockchain block signing, and multi-GPU distributed inference.

