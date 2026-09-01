import os
import io
import json
import uuid
import datetime
import asyncio
import numpy as np
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session

from backend.models.database import (
    init_db,
    get_db,
    SessionLocal,
    Speaker,
    CallSession,
    BlockchainBlock
)
from backend.pipeline.stage1_preprocessing import AudioPreprocessor
from backend.pipeline.stage2_deepfake_detector import DeepfakeDetectionEngine
from backend.pipeline.stage3_speaker_verification import SpeakerVerificationEngine
from backend.pipeline.stage4_risk_engine import RiskDecisionEngine
from backend.pipeline.blockchain_ledger import BlockchainAuditLedger
from backend.sample_audio_generator import generate_sample_audio_files

# Initialize FastAPI App
app = FastAPI(
    title="Deadlock — AI Voice Cloning Detector & Biometric Cyber-Defense",
    description="Real-Time Detection & Prevention of AI Voice Cloning Impersonation Attacks (SIH 2026 PS 26104)",
    version="1.0.0"
)

# Configure CORS for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate Pipeline Stages
preprocessor = AudioPreprocessor(target_sr=16000)
deepfake_engine = DeepfakeDetectionEngine()
biometric_engine = SpeakerVerificationEngine(embedding_dim=256, match_threshold=0.72)
risk_engine = RiskDecisionEngine()

# Sample Audios Directory
SAMPLES_DIR = os.path.abspath("./sample_audios")
os.makedirs(SAMPLES_DIR, exist_ok=True)
app.mount("/static/samples", StaticFiles(directory=SAMPLES_DIR), name="samples")

# Frontend Dist Directory (for single-service deployment on Render)
DIST_DIR = os.path.abspath("./frontend/dist")
ASSETS_DIR = os.path.join(DIST_DIR, "assets")
if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="frontend_assets")


@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        BlockchainAuditLedger.ensure_genesis_block(db)
        
        # Pre-enroll or update Alice Walker (Executive CFO) reference voiceprint
        sample_paths = generate_sample_audio_files(SAMPLES_DIR)
        alice = db.query(Speaker).filter(Speaker.name == "Alice Walker").first()
        is_new = False
        if os.path.exists(sample_paths["alice_real"]):
            y_alice, sr = preprocessor.load_audio(sample_paths["alice_real"])
            feat_alice = preprocessor.extract_features(y_alice, sr)
            emb_alice = biometric_engine.extract_embedding(feat_alice)
            vid = BlockchainAuditLedger.generate_voiceprint_id("Alice Walker", emb_alice)
            
            if not alice:
                is_new = True
                alice = Speaker(
                    name="Alice Walker",
                    email="alice.walker@enterprise.secure",
                    role="Chief Financial Officer (CFO)",
                    department="Executive Finance",
                    voiceprint_id=vid,
                    status="ACTIVE"
                )
                db.add(alice)
            alice.voiceprint_id = vid
            alice.set_embedding(emb_alice)
            db.commit()
            db.refresh(alice)
            
            if is_new:
                # Record enrollment on blockchain
                BlockchainAuditLedger.record_call_event(
                    db=db,
                    session_id=f"ENROLL-{alice.id[:8]}",
                    claimed_identity="Alice Walker",
                    event_type="VOICEPRINT_ENROLLMENT",
                    decision="ENROLLMENT_VERIFIED",
                    risk_score=0.0,
                    payload_dict={"voiceprint_id": vid, "role": alice.role}
                )
    finally:
        db.close()


# ==========================================
# REST API ENDPOINTS
# ==========================================

@app.get("/api/status")
def get_system_status(db: Session = Depends(get_db)):
    """System health, pipeline readiness, and security stats."""
    speakers_count = db.query(Speaker).count()
    sessions_count = db.query(CallSession).count()
    blocks_count = db.query(BlockchainBlock).count()
    threats_blocked = db.query(CallSession).filter(CallSession.decision == "BLOCK_AND_ALERT").count()

    return {
        "status": "ONLINE",
        "system": "Deadlock Defense Core v1.0",
        "hackathon": "Smart India Hackathon 2026",
        "problem_statement": "26104 (AI Voice Cloning Impersonation Detection)",
        "theme": "Blockchain & Cybersecurity",
        "pipeline_stages": {
            "stage1_preprocessing": "16kHz_VAD_MEL_LFCC_MFCC_ONLINE",
            "stage2_deepfake_detector": "DEADLOCK_NET_CNN_BILSTM_HEURISTICS_ONLINE",
            "stage3_speaker_biometrics": "256D_L2_NORMALIZED_COSINE_ONLINE",
            "stage4_risk_decision": "MULTI_FACTOR_DYNAMIC_MATRIX_ONLINE",
            "blockchain_ledger": "SHA256_HMAC_CHAINED_IMMUTABLE_ONLINE",
        },
        "stats": {
            "enrolled_identities": speakers_count,
            "total_calls_analyzed": sessions_count,
            "threats_intercepted": threats_blocked,
            "blockchain_blocks_sealed": blocks_count
        }
    }


@app.get("/api/samples")
def get_sample_test_scenarios():
    """List pre-loaded audio scenarios for instant 1-click hackathon evaluation."""
    return [
        {
            "id": "alice_real",
            "title": "Scenario A: Authorized CFO",
            "speaker_name": "Alice Walker",
            "description": "Authentic human speech from enrolled CFO Alice with natural pitch and spectral resonance.",
            "audio_url": "/static/samples/alice_real_authorized.wav",
            "expected_outcome": "ALLOW_ACCESS",
            "expected_risk": "SAFE (<20%)"
        },
        {
            "id": "alice_clone",
            "title": "Scenario B: AI Voice Clone",
            "speaker_name": "Alice Walker",
            "description": "Synthetic voice clone of Alice exhibiting vocoder cutoffs and pitch quantization.",
            "audio_url": "/static/samples/alice_cloned_elevenlabs.wav",
            "expected_outcome": "BLOCK_AND_ALERT",
            "expected_risk": "CRITICAL (>85%)"
        },
        {
            "id": "bob_impersonator",
            "title": "Scenario C: Human Impersonator",
            "speaker_name": "Alice Walker",
            "description": "Unregistered male speaker attempting biometric voice impersonation of Alice.",
            "audio_url": "/static/samples/bob_real_impersonator.wav",
            "expected_outcome": "SUSPICIOUS_WARN",
            "expected_risk": "ELEVATED (>60%)"
        },
        {
            "id": "noisy_deepfake",
            "title": "Scenario D: Noisy Deepfake",
            "speaker_name": "Alice Walker",
            "description": "Synthetic deepfake speech layered with telephony bandpass channel noise.",
            "audio_url": "/static/samples/carol_noisy_deepfake.wav",
            "expected_outcome": "BLOCK_AND_ALERT",
            "expected_risk": "CRITICAL (>75%)"
        }
    ]


@app.get("/api/speakers")
def list_enrolled_speakers(db: Session = Depends(get_db)):
    """List all registered biometric identities."""
    speakers = db.query(Speaker).order_by(Speaker.created_at.desc()).all()
    return [s.to_dict() for s in speakers]


@app.post("/api/enroll")
async def enroll_speaker(
    name: str = Form(...),
    email: Optional[str] = Form(None),
    role: str = Form("Authorized Personnel"),
    department: str = Form("Operations"),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Enroll a new biometric voiceprint into the database & blockchain ledger."""
    audio_bytes = await audio_file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file provided")

    y, sr = preprocessor.load_audio(audio_bytes)
    if len(y) < sr * 0.5:
        raise HTTPException(status_code=400, detail="Audio too short for biometric enrollment (minimum 0.5s required)")

    features = preprocessor.extract_features(y, sr)
    embedding = biometric_engine.extract_embedding(features)
    vid = BlockchainAuditLedger.generate_voiceprint_id(name, embedding)

    # Check if speaker exists
    speaker = db.query(Speaker).filter(Speaker.name == name).first()
    if speaker:
        speaker.email = email or speaker.email
        speaker.role = role
        speaker.department = department
        speaker.voiceprint_id = vid
        speaker.set_embedding(embedding)
    else:
        speaker = Speaker(
            name=name,
            email=email,
            role=role,
            department=department,
            voiceprint_id=vid,
            status="ACTIVE"
        )
        speaker.set_embedding(embedding)
        db.add(speaker)

    db.commit()
    db.refresh(speaker)

    # Record blockchain block for enrollment
    block = BlockchainAuditLedger.record_call_event(
        db=db,
        session_id=f"ENROLL-{speaker.id[:8]}",
        claimed_identity=name,
        event_type="VOICEPRINT_ENROLLMENT",
        decision="ENROLLMENT_VERIFIED",
        risk_score=0.0,
        payload_dict={"voiceprint_id": vid, "role": role, "department": department}
    )

    radar_profile = biometric_engine.generate_radar_profile(embedding)

    return {
        "success": True,
        "message": f"Biometric voiceprint for '{name}' successfully enrolled and cryptographically anchored.",
        "speaker": speaker.to_dict(),
        "radar_profile": radar_profile,
        "blockchain_block": block.to_dict()
    }


@app.delete("/api/speakers/{speaker_id}")
def delete_speaker(speaker_id: str, db: Session = Depends(get_db)):
    """Revoke and delete an enrolled speaker identity."""
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker identity not found")

    name = speaker.name
    db.delete(speaker)
    db.commit()

    BlockchainAuditLedger.record_call_event(
        db=db,
        session_id=f"REVOKE-{speaker_id[:8]}",
        claimed_identity=name,
        event_type="VOICEPRINT_REVOCATION",
        decision="IDENTITY_REVOKED",
        risk_score=0.0,
        payload_dict={"revoked_speaker_id": speaker_id, "name": name}
    )

    return {"success": True, "message": f"Voiceprint for {name} revoked."}


@app.post("/api/analyze")
async def analyze_audio_call(
    audio_file: Optional[UploadFile] = File(None),
    sample_id: Optional[str] = Form(None),
    claimed_identity: Optional[str] = Form("Unknown Caller"),
    target_speaker_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Complete 4-stage pipeline execution on recorded or uploaded audio.
    Stage 1: Preprocessing & Acoustic Features
    Stage 2: AI Deepfake Detection (DeadlockNet + Heuristics)
    Stage 3: Speaker Verification (Cosine Embedding Match)
    Stage 4: Risk Evaluation & Multi-Channel Alerting
    """
    audio_filename = "recorded_audio.wav"
    
    if sample_id:
        sample_map = generate_sample_audio_files(SAMPLES_DIR)
        file_path = sample_map.get(sample_id)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Sample '{sample_id}' not found")
        y, sr = preprocessor.load_audio(file_path)
        audio_filename = os.path.basename(file_path)
    elif audio_file:
        audio_bytes = await audio_file.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty")
        y, sr = preprocessor.load_audio(audio_bytes)
        audio_filename = audio_file.filename or "upload.wav"
    else:
        raise HTTPException(status_code=400, detail="No audio file or sample_id provided")

    # STAGE 1: Preprocessing & Feature Extraction
    features = preprocessor.extract_features(y, sr)
    query_embedding = biometric_engine.extract_embedding(features)
    query_radar = biometric_engine.generate_radar_profile(query_embedding)

    # STAGE 2: Deepfake & Synthetic Voice Classification
    deepfake_res = deepfake_engine.analyze(features)

    # STAGE 3: Speaker Biometric Verification
    target_speaker = None
    if target_speaker_id:
        target_speaker = db.query(Speaker).filter(Speaker.id == target_speaker_id).first()
    elif claimed_identity and claimed_identity.lower() not in ["", "unknown caller", "anonymous"]:
        target_speaker = db.query(Speaker).filter(Speaker.name.ilike(f"%{claimed_identity}%")).first()

    verification_res = None
    target_radar = None
    if target_speaker:
        target_emb = target_speaker.get_embedding()
        verification_res = biometric_engine.compare_embeddings(query_embedding, target_emb)
        target_radar = biometric_engine.generate_radar_profile(target_emb)
    else:
        verification_res = {
            "cosine_similarity": 0.50,
            "euclidean_distance": 1.0,
            "match_confidence": 0.50,
            "is_matched": False,
            "match_grade": "NO_STORED_IDENTITY_SPECIFIED"
        }

    # STAGE 4: Risk Analysis & Decision Engine
    risk_res = risk_engine.evaluate(
        deepfake_analysis=deepfake_res,
        verification_analysis=verification_res,
        claimed_speaker_name=claimed_identity if target_speaker or claimed_identity != "Unknown Caller" else None
    )

    # Create Session & Blockchain Block
    session_id = f"CALL-{uuid.uuid4().hex[:8].upper()}"
    
    # Cryptographic Block in Blockchain
    block = BlockchainAuditLedger.record_call_event(
        db=db,
        session_id=session_id,
        claimed_identity=claimed_identity or "Unknown",
        event_type="CALL_VERIFICATION",
        decision=risk_res["decision"],
        risk_score=risk_res["risk_score"],
        payload_dict={
            "audio_filename": audio_filename,
            "deepfake_score": deepfake_res["deepfake_score"],
            "verification_score": verification_res["match_confidence"] if verification_res else 0.0,
            "risk_score": risk_res["risk_score"],
            "decision": risk_res["decision"]
        }
    )

    # Save Call Session Log
    call_log = CallSession(
        id=session_id,
        speaker_id=target_speaker.id if target_speaker else None,
        claimed_identity=claimed_identity or "Unknown",
        audio_filename=audio_filename,
        duration_seconds=features["duration"],
        deepfake_score=deepfake_res["deepfake_score"],
        deepfake_label=deepfake_res["classification"],
        verification_score=verification_res["match_confidence"] if verification_res else 0.0,
        is_speaker_matched=verification_res.get("is_matched", False) if verification_res else False,
        risk_score=risk_res["risk_score"],
        decision=risk_res["decision"],
        forensics_json=json.dumps({
            "telemetry": features["telemetry"],
            "sub_scores": deepfake_res["sub_scores"],
            "forensic_flags": deepfake_res["forensic_flags"]
        }),
        blockchain_block_id=block.index
    )
    db.add(call_log)
    db.commit()

    return {
        "session_id": session_id,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "claimed_identity": claimed_identity,
        "target_speaker": target_speaker.to_dict() if target_speaker else None,
        "stage1_preprocessing": {
            "duration": features["duration"],
            "sample_rate": features["sample_rate"],
            "num_samples": features["num_samples"],
            "waveform_preview": features["waveform_preview"],
            "spectrogram_preview": features["spectrogram_preview"],
            "f0_track": features["f0_track"],
            "telemetry": features["telemetry"],
        },
        "stage2_deepfake": deepfake_res,
        "stage3_verification": verification_res,
        "stage4_risk_decision": risk_res,
        "biometrics": {
            "query_radar": query_radar,
            "target_radar": target_radar
        },
        "blockchain_block": block.to_dict()
    }


@app.get("/api/incidents")
def get_call_incidents(
    limit: int = 50,
    decision_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Query recent call security logs & incident history."""
    query = db.query(CallSession).order_by(CallSession.timestamp.desc())
    if decision_filter:
        query = query.filter(CallSession.decision == decision_filter)
    
    sessions = query.limit(limit).all()
    return [s.to_dict() for s in sessions]


@app.get("/api/blockchain/ledger")
def get_blockchain_ledger(limit: int = 50, db: Session = Depends(get_db)):
    """Inspect immutable cryptographic blockchain verification blocks."""
    blocks = db.query(BlockchainBlock).order_by(BlockchainBlock.index.desc()).limit(limit).all()
    integrity = BlockchainAuditLedger.verify_ledger_integrity(db)
    return {
        "integrity": integrity,
        "blocks": [b.to_dict() for b in blocks]
    }


@app.get("/api/blockchain/verify")
def verify_blockchain(db: Session = Depends(get_db)):
    """Recalculate SHA-256 hash chains across all blocks to prove zero tampering."""
    return BlockchainAuditLedger.verify_ledger_integrity(db)


# ==========================================
# WEBSOCKET REAL-TIME STREAMING ENDPOINT
# ==========================================

@app.websocket("/ws/live-call")
async def websocket_live_call_analyzer(websocket: WebSocket):
    """
    Real-Time WebSocket stream for live call interception.
    Receives raw audio chunks from client microphone/stream,
    computes rolling acoustic telemetry, and broadcasts live risk scores.
    """
    await websocket.accept()
    buffer = bytearray()
    claimed_speaker = "Alice Walker" # Default target identity for live stream

    try:
        while True:
            data = await websocket.receive()
            
            # Handle text config messages
            if "text" in data:
                try:
                    msg = json.loads(data["text"])
                    if msg.get("type") == "SET_SPEAKER":
                        claimed_speaker = msg.get("speaker_name", "Alice Walker")
                        await websocket.send_json({
                            "type": "CONFIG_ACK",
                            "claimed_speaker": claimed_speaker
                        })
                    elif msg.get("type") == "PING":
                        await websocket.send_json({"type": "PONG"})
                except Exception:
                    pass
                continue

            # Handle binary PCM audio chunks
            if "bytes" in data:
                chunk_bytes = data["bytes"]
                buffer.extend(chunk_bytes)
                
                # Process window when we accumulate at least 1.0 second (~32,000 bytes for 16-bit 16kHz PCM)
                if len(buffer) >= 32000:
                    # Extract last 1.5 seconds of audio for sliding analysis
                    window_bytes = bytes(buffer[-48000:])
                    
                    # Convert raw PCM bytes (int16) to numpy float32
                    audio_arr = np.frombuffer(window_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                    
                    # Extract live features
                    features = preprocessor.extract_features(audio_arr, 16000)
                    deepfake_res = deepfake_engine.analyze(features)
                    
                    # Live rolling risk calculation
                    p_fake = deepfake_res["deepfake_score"]
                    p_anomaly = deepfake_res["acoustic_forensic_score"]
                    
                    rolling_risk = round(0.60 * p_fake + 0.40 * p_anomaly, 4)
                    
                    # Instant decision
                    if rolling_risk >= 0.65 or p_fake >= 0.65:
                        instant_decision = "BLOCK_AND_ALERT"
                        badge_color = "red"
                    elif rolling_risk >= 0.35:
                        instant_decision = "SUSPICIOUS_WARN"
                        badge_color = "amber"
                    else:
                        instant_decision = "ALLOW_ACCESS"
                        badge_color = "green"

                    # Live Telemetry packet
                    await websocket.send_json({
                        "type": "LIVE_TELEMETRY",
                        "timestamp": datetime.datetime.utcnow().isoformat(),
                        "rolling_risk": rolling_risk,
                        "rolling_risk_pct": round(rolling_risk * 100, 1),
                        "deepfake_score": p_fake,
                        "deepfake_score_pct": round(p_fake * 100, 1),
                        "deepfake_classification": deepfake_res["classification"],
                        "instant_decision": instant_decision,
                        "badge_color": badge_color,
                        "telemetry": features["telemetry"],
                        "sub_scores": deepfake_res["sub_scores"],
                        "waveform_chunk": features["waveform_preview"][:30],
                        "claimed_speaker": claimed_speaker
                    })

                    # If risk is critical, dispatch an active alert breach event
                    if instant_decision == "BLOCK_AND_ALERT":
                        await websocket.send_json({
                            "type": "ALERT_BREACH",
                            "severity": "CRITICAL",
                            "message": "AI Voice Clone Impersonation Detected in Live Audio Stream!",
                            "risk_pct": round(rolling_risk * 100, 1),
                            "deepfake_pct": round(p_fake * 100, 1)
                        })

                    # Keep buffer from growing unbounded
                    if len(buffer) > 160000:
                        buffer = buffer[-64000:]
                        
    except WebSocketDisconnect:
        pass
    except Exception as e:
        pass


# ==========================================
# PRODUCTION SPA SERVING (RENDER DEPLOYMENT)
# ==========================================

@app.get("/")
@app.get("/{full_path:path}")
def serve_spa(full_path: str = ""):
    """
    Serve compiled React SPA on Render for all non-API routes.
    Enables single-port full-stack web application hosting.
    """
    if full_path and (full_path.startswith("api/") or full_path.startswith("ws/") or full_path.startswith("static/")):
        raise HTTPException(status_code=404, detail="Endpoint not found")
        
    file_path = os.path.join(DIST_DIR, full_path)
    if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
        
    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
        
    return JSONResponse(
        status_code=200,
        content={
            "status": "ONLINE",
            "message": "Deadlock API is running. Build frontend with 'npm run build' inside frontend/ to view web dashboard.",
            "docs": "/docs"
        }
    )

