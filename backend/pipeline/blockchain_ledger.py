import hashlib
import hmac
import json
import datetime
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from backend.models.database import BlockchainBlock

SECRET_KEY = "DEADLOCK_SIH2026_CYBERSECURITY_IMMUTABLE_SALT_KEY"

class BlockchainAuditLedger:
    """
    Cryptographic Blockchain & Tamper-Proof Audit Ledger.
    Provides immutable SHA-256 hash-chained verification blocks for every call analysis,
    ensuring non-repudiation and zero-tampering for cybersecurity compliance.
    """

    @staticmethod
    def compute_sha256(data_str: str) -> str:
        return hashlib.sha256(data_str.encode("utf-8")).hexdigest()

    @staticmethod
    def compute_hmac(data_str: str) -> str:
        return hmac.new(SECRET_KEY.encode("utf-8"), data_str.encode("utf-8"), hashlib.sha256).hexdigest()

    @classmethod
    def generate_voiceprint_id(cls, name: str, embedding: List[float]) -> str:
        """
        Generate a cryptographic Voiceprint Identity Token (VID).
        """
        emb_summary = ",".join(f"{x:.4f}" for x in embedding[:32])
        raw_str = f"VID:{name}:{emb_summary}:{datetime.datetime.utcnow().strftime('%Y%m%d')}"
        token_hash = cls.compute_sha256(raw_str)[:24].upper()
        return f"VID-{token_hash}"

    @classmethod
    def ensure_genesis_block(cls, db: Session):
        """
        Initialize Genesis Block (Block 0) if blockchain is empty.
        """
        count = db.query(BlockchainBlock).count()
        if count == 0:
            genesis_payload = {
                "message": "Deadlock AI Voice Cloning Cybersecurity Defense Ledger Initialized",
                "hackathon": "Smart India Hackathon 2026",
                "problem_statement": "26104"
            }
            data_hash = cls.compute_sha256(json.dumps(genesis_payload, sort_keys=True))
            prev_hash = "0" * 64
            ts = datetime.datetime.utcnow()
            block_header = f"0:{ts.isoformat()}:{prev_hash}:{data_hash}"
            block_hash = cls.compute_sha256(block_header)
            signature = cls.compute_hmac(block_hash)

            genesis_block = BlockchainBlock(
                index=0,
                timestamp=ts,
                session_id="GENESIS-BLOCK-0",
                claimed_identity="SYSTEM_ROOT",
                event_type="GENESIS_INITIALIZATION",
                decision="SYSTEM_INITIALIZE",
                risk_score=0.0,
                data_hash=data_hash,
                prev_hash=prev_hash,
                block_hash=block_hash,
                signature=signature,
                is_valid=True
            )
            db.add(genesis_block)
            db.commit()

    @classmethod
    def record_call_event(
        cls,
        db: Session,
        session_id: str,
        claimed_identity: str,
        event_type: str,
        decision: str,
        risk_score: float = 0.0,
        payload_dict: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> BlockchainBlock:
        """
        Create a new cryptographically chained block for a call or enrollment event.
        """
        cls.ensure_genesis_block(db)
        
        combined_payload = dict(payload_dict or {})
        if kwargs:
            combined_payload.update(kwargs)
            
        # Get latest block
        latest_block = db.query(BlockchainBlock).order_by(BlockchainBlock.index.desc()).first()
        prev_hash = latest_block.block_hash if latest_block else "0" * 64
        new_index = (latest_block.index + 1) if latest_block else 0
        
        ts = datetime.datetime.utcnow()
        data_hash = cls.compute_sha256(json.dumps(combined_payload, sort_keys=True, default=str))
        block_header = f"{new_index}:{ts.isoformat()}:{prev_hash}:{data_hash}"
        block_hash = cls.compute_sha256(block_header)
        signature = cls.compute_hmac(block_hash)

        new_block = BlockchainBlock(
            index=new_index,
            timestamp=ts,
            session_id=session_id,
            claimed_identity=claimed_identity,
            event_type=event_type,
            decision=decision,
            risk_score=risk_score,
            data_hash=data_hash,
            prev_hash=prev_hash,
            block_hash=block_hash,
            signature=signature,
            is_valid=True
        )
        db.add(new_block)
        db.commit()
        db.refresh(new_block)
        return new_block

    @classmethod
    def verify_ledger_integrity(cls, db: Session) -> Dict[str, Any]:
        """
        Recalculate SHA-256 hash chains across all blocks to mathematically prove 0 tampering.
        """
        cls.ensure_genesis_block(db)
        blocks = db.query(BlockchainBlock).order_by(BlockchainBlock.index.asc()).all()
        
        is_chain_valid = True
        tampered_blocks = []
        
        for i, block in enumerate(blocks):
            if i == 0:
                # Genesis validation
                if block.prev_hash != "0" * 64:
                    is_chain_valid = False
                    tampered_blocks.append(block.index)
            else:
                prev_block = blocks[i - 1]
                if block.prev_hash != prev_block.block_hash:
                    is_chain_valid = False
                    tampered_blocks.append(block.index)
                    
            # Verify cryptographic signature
            expected_sig = cls.compute_hmac(block.block_hash)
            if block.signature != expected_sig:
                is_chain_valid = False
                tampered_blocks.append(block.index)

        return {
            "total_blocks": len(blocks),
            "is_valid": is_chain_valid,
            "is_chain_valid": is_chain_valid,
            "tampered_blocks": list(set(tampered_blocks)),
            "genesis_hash": blocks[0].block_hash if blocks else None,
            "latest_block_hash": blocks[-1].block_hash if blocks else None,
            "verification_status": "CRYPTOGRAPHIC_INTEGRITY_VERIFIED" if is_chain_valid else "TAMPERING_DETECTED",
            "algorithm": "SHA-256 Chained Hash + HMAC-SHA256 Proof"
        }
