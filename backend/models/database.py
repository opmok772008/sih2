import datetime
import json
import uuid
from typing import List, Optional
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    Boolean,
    create_engine,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

Base = declarative_base()

class Speaker(Base):
    __tablename__ = "speakers"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(128), nullable=False, index=True)
    email = Column(String(128), nullable=True)
    role = Column(String(64), default="Authorized Executive")
    department = Column(String(64), default="Operations")
    voiceprint_id = Column(String(128), unique=True, nullable=False) # Cryptographic VID
    embedding_json = Column(Text, nullable=False) # 256-d vector stored as JSON string
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String(32), default="ACTIVE") # ACTIVE, SUSPENDED, REVOKED

    def get_embedding(self) -> List[float]:
        return json.loads(self.embedding_json)

    def set_embedding(self, emb: List[float]):
        self.embedding_json = json.dumps(emb)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "voiceprint_id": self.voiceprint_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "status": self.status,
            "embedding_dims": len(self.get_embedding()) if self.embedding_json else 0,
        }


class CallSession(Base):
    __tablename__ = "call_sessions"

    id = Column(String(64), primary_key=True, default=lambda: f"CALL-{uuid.uuid4().hex[:8].upper()}")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    speaker_id = Column(String(64), ForeignKey("speakers.id"), nullable=True)
    claimed_identity = Column(String(128), nullable=False, default="Unknown Caller")
    audio_filename = Column(String(256), nullable=True)
    duration_seconds = Column(Float, default=0.0)
    
    # 4-Stage Pipeline Metrics
    deepfake_score = Column(Float, nullable=False, default=0.0) # 0.0 (Real) to 1.0 (Fake)
    deepfake_label = Column(String(32), default="REAL") # REAL, AI_GENERATED, SPOOFED
    verification_score = Column(Float, nullable=False, default=0.0) # 0.0 to 1.0 (Match Confidence)
    is_speaker_matched = Column(Boolean, default=False)
    risk_score = Column(Float, nullable=False, default=0.0) # 0.0 (Safe) to 1.0 (High Threat)
    decision = Column(String(32), nullable=False, default="ALLOW_ACCESS") # ALLOW_ACCESS, SUSPICIOUS_WARN, BLOCK_AND_ALERT
    
    # Forensic data
    forensics_json = Column(Text, nullable=True) # Detailed spectral/vocoder/pitch telemetry
    blockchain_block_id = Column(Integer, nullable=True) # Linked ledger block

    def to_dict(self):
        forensics = json.loads(self.forensics_json) if self.forensics_json else {}
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "speaker_id": self.speaker_id,
            "claimed_identity": self.claimed_identity,
            "duration_seconds": round(self.duration_seconds, 2),
            "deepfake_score": round(self.deepfake_score, 4),
            "deepfake_label": self.deepfake_label,
            "verification_score": round(self.verification_score, 4),
            "is_speaker_matched": self.is_speaker_matched,
            "risk_score": round(self.risk_score, 4),
            "decision": self.decision,
            "forensics": forensics,
            "blockchain_block_id": self.blockchain_block_id,
        }


class BlockchainBlock(Base):
    __tablename__ = "blockchain_blocks"

    index = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    session_id = Column(String(64), nullable=False)
    claimed_identity = Column(String(128), nullable=False)
    event_type = Column(String(64), nullable=False) # CALL_VERIFICATION, ENROLLMENT, SECURITY_ALERT
    decision = Column(String(32), nullable=False)
    risk_score = Column(Float, default=0.0)
    data_hash = Column(String(64), nullable=False) # SHA-256 hash of payload
    prev_hash = Column(String(64), nullable=False) # Hash of preceding block
    block_hash = Column(String(64), unique=True, nullable=False) # SHA-256 block header hash
    signature = Column(String(128), nullable=False) # Cryptographic HMAC/ECDSA proof
    is_valid = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "index": self.index,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "session_id": self.session_id,
            "claimed_identity": self.claimed_identity,
            "event_type": self.event_type,
            "decision": self.decision,
            "risk_score": round(self.risk_score, 4),
            "data_hash": self.data_hash,
            "prev_hash": self.prev_hash,
            "block_hash": self.block_hash,
            "signature": self.signature,
            "is_valid": self.is_valid,
        }


# Database Initialization Helper
DATABASE_URL = "sqlite:///./deadlock_security.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
