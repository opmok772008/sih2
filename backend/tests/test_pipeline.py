import os
import sys
import numpy as np
import pytest

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.pipeline.stage1_preprocessing import AudioPreprocessor
from backend.pipeline.stage2_deepfake_detector import DeepfakeDetectionEngine
from backend.pipeline.stage3_speaker_verification import SpeakerVerificationEngine
from backend.pipeline.stage4_risk_engine import RiskDecisionEngine
from backend.pipeline.blockchain_ledger import BlockchainAuditLedger
from backend.sample_audio_generator import generate_sample_audio_files
from backend.models.database import init_db, SessionLocal, Speaker, BlockchainBlock

@pytest.fixture(scope="module")
def samples_and_db():
    init_db()
    db = SessionLocal()
    sample_dir = os.path.abspath("./test_sample_audios")
    sample_paths = generate_sample_audio_files(sample_dir)
    BlockchainAuditLedger.ensure_genesis_block(db)
    yield sample_paths, db
    db.close()

def test_stage1_preprocessing(samples_and_db):
    sample_paths, _ = samples_and_db
    preprocessor = AudioPreprocessor(target_sr=16000)
    
    # Test loading real audio
    y, sr = preprocessor.load_audio(sample_paths["alice_real"])
    assert sr == 16000
    assert len(y) > 0
    assert np.max(np.abs(y)) <= 1.0
    
    # Test feature extraction
    features = preprocessor.extract_features(y, sr)
    assert "telemetry" in features
    assert "waveform_preview" in features
    assert "spectrogram_preview" in features
    assert len(features["waveform_preview"]) > 0
    assert features["telemetry"]["pitch_mean_hz"] > 0
    print("Stage 1 Preprocessing passed with pitch:", features["telemetry"]["pitch_mean_hz"])

def test_stage2_deepfake_detection(samples_and_db):
    sample_paths, _ = samples_and_db
    preprocessor = AudioPreprocessor(target_sr=16000)
    detector = DeepfakeDetectionEngine()
    
    # 1. Analyze Real Human Speech
    y_real, sr = preprocessor.load_audio(sample_paths["alice_real"])
    feat_real = preprocessor.extract_features(y_real, sr)
    res_real = detector.analyze(feat_real)
    
    # 2. Analyze AI Cloned Speech
    y_clone, sr = preprocessor.load_audio(sample_paths["alice_clone"])
    feat_clone = preprocessor.extract_features(y_clone, sr)
    res_clone = detector.analyze(feat_clone)
    
    print(f"Real sample deepfake score: {res_real['deepfake_score']} ({res_real['classification']})")
    print(f"Clone sample deepfake score: {res_clone['deepfake_score']} ({res_clone['classification']})")
    
    # Clone should have a significantly higher deepfake score than real
    assert res_clone["deepfake_score"] > res_real["deepfake_score"]
    assert res_clone["deepfake_score"] >= 0.50
    assert "sub_scores" in res_clone
    assert len(res_clone["forensic_flags"]) > 0

def test_stage3_speaker_verification(samples_and_db):
    sample_paths, _ = samples_and_db
    preprocessor = AudioPreprocessor(target_sr=16000)
    verifier = SpeakerVerificationEngine()
    
    # Alice Real
    y_alice, sr = preprocessor.load_audio(sample_paths["alice_real"])
    feat_alice = preprocessor.extract_features(y_alice, sr)
    emb_alice = verifier.extract_embedding(feat_alice)
    assert len(emb_alice) == 256
    
    # Compare Alice with herself (100% match)
    match_self = verifier.compare_embeddings(emb_alice, emb_alice)
    assert match_self["cosine_similarity"] >= 0.99
    assert match_self["is_matched"] is True
    
    # Compare Alice with Bob Impersonator
    y_bob, sr = preprocessor.load_audio(sample_paths["bob_impersonator"])
    feat_bob = preprocessor.extract_features(y_bob, sr)
    emb_bob = verifier.extract_embedding(feat_bob)
    
    match_diff = verifier.compare_embeddings(emb_alice, emb_bob)
    print(f"Alice vs Self similarity: {match_self['cosine_similarity']}, Alice vs Bob similarity: {match_diff['cosine_similarity']}")
    assert match_diff["cosine_similarity"] < match_self["cosine_similarity"]

def test_stage4_risk_decision_matrix():
    risk_engine = RiskDecisionEngine()
    
    # Case 1: Genuine Human + Verified Speaker -> ALLOW_ACCESS
    decision_safe = risk_engine.evaluate(
        deepfake_analysis={"deepfake_score": 0.12, "acoustic_forensic_score": 0.10},
        verification_analysis={"match_confidence": 0.92, "is_matched": True},
        claimed_speaker_name="Alice Walker"
    )
    assert decision_safe["decision"] == "ALLOW_ACCESS"
    assert decision_safe["risk_score"] < 0.35
    
    # Case 2: Deepfake Cloned Voice -> BLOCK_AND_ALERT
    decision_blocked = risk_engine.evaluate(
        deepfake_analysis={"deepfake_score": 0.88, "acoustic_forensic_score": 0.75},
        verification_analysis={"match_confidence": 0.80, "is_matched": True},
        claimed_speaker_name="Alice Walker"
    )
    assert decision_blocked["decision"] == "BLOCK_AND_ALERT"
    assert decision_blocked["risk_score"] >= 0.65
    assert len(decision_blocked["threat_vectors"]) > 0

def test_blockchain_cryptographic_ledger(samples_and_db):
    _, db = samples_and_db
    
    # Add a sample verification block
    block = BlockchainAuditLedger.record_call_event(
        db=db,
        session_id="TEST-SESSION-001",
        claimed_identity="Alice Walker",
        event_type="CALL_VERIFICATION",
        decision="BLOCK_AND_ALERT",
        risk_score=0.88,
        payload_dict={"test": "payload"}
    )
    assert block.index > 0
    assert block.block_hash is not None
    assert block.prev_hash is not None
    
    # Verify ledger integrity
    integrity = BlockchainAuditLedger.verify_ledger_integrity(db)
    assert integrity["is_valid"] is True
    assert integrity["verification_status"] == "CRYPTOGRAPHIC_INTEGRITY_VERIFIED"
    print("Blockchain ledger integrity verified across", integrity["total_blocks"], "blocks")

if __name__ == "__main__":
    pytest.main(["-v", __file__])
