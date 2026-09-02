import datetime
from typing import Dict, Any, List, Optional

class RiskDecisionEngine:
    """
    Stage 4: Multi-Factor Risk Analysis, Decision Matrix & Alert Notification Dispatcher.
    Combines Deepfake Probabilities, Speaker Verification Confidences, and Forensic Telemetry
    into an actionable security verdict (ALLOW_ACCESS, SUSPICIOUS_WARN, BLOCK_AND_ALERT).
    """

    def __init__(
        self,
        deepfake_weight: float = 0.50,
        biometric_weight: float = 0.35,
        anomaly_weight: float = 0.15,
        safe_risk_threshold: float = 0.35,
        block_risk_threshold: float = 0.65
    ):
        self.w_deepfake = deepfake_weight
        self.w_biometric = biometric_weight
        self.w_anomaly = anomaly_weight
        self.thresh_safe = safe_risk_threshold
        self.thresh_block = block_risk_threshold

    def evaluate(
        self,
        deepfake_analysis: Dict[str, Any],
        verification_analysis: Optional[Dict[str, Any]],
        claimed_speaker_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compute composite risk score and generate security verdict.
        """
        p_fake = float(deepfake_analysis.get("deepfake_score", 0.0))
        p_anomaly = float(deepfake_analysis.get("acoustic_forensic_score", 0.0))
        
        has_claimed_identity = claimed_speaker_name and claimed_speaker_name.lower() not in ["", "unknown", "none", "anonymous"]
        
        if verification_analysis is not None and has_claimed_identity:
            p_match = float(verification_analysis.get("match_confidence", 0.5))
            is_matched = bool(verification_analysis.get("is_matched", False))
            biometric_risk = 1.0 - p_match
        else:
            # If no speaker claimed, biometric risk is neutral (0.15) if speech is genuine
            p_match = 1.0 if p_fake < 0.35 else 0.5
            is_matched = True if p_fake < 0.35 else False
            biometric_risk = 0.15

        # Weighted Risk Formula
        composite_risk = (
            self.w_deepfake * p_fake +
            self.w_biometric * biometric_risk +
            self.w_anomaly * p_anomaly
        )
        
        # Attack amplification rule: If deepfake score > 0.55
        if p_fake >= 0.55:
            composite_risk = max(composite_risk, 0.85)
        elif has_claimed_identity and not is_matched and p_fake > 0.40:
            composite_risk = max(composite_risk, 0.78)

        composite_risk = round(max(0.01, min(0.99, composite_risk)), 4)

        # Decision Threshold Classifier
        threat_vectors = []
        if p_fake >= 0.55:
            threat_vectors.append("SYNTHETIC_VOICE_CLONE_ATTACK")
        if has_claimed_identity and not is_matched:
            threat_vectors.append("SPEAKER_IMPERSONATION_MISMATCH")
        if p_anomaly >= 0.55:
            threat_vectors.append("VOCODER_SPECTRAL_ARTIFACTS")

        # Clear, mutually exclusive security verdict classification
        if p_fake >= 0.55 or (composite_risk >= self.thresh_block and p_fake >= 0.35):
            decision = "BLOCK_AND_ALERT"
            threat_level = "CRITICAL"
            badge_color = "red"
            action = "TERMINATE_CALL_IMMEDIATELY"
            recommendation = (
                "Critical Security Breach: Active AI voice cloning / synthetic speech attack intercepted. "
                "Neural vocoder artifacts detected. The incoming audio stream has been blocked."
            )
        elif (has_claimed_identity and not is_matched) or composite_risk >= self.thresh_safe or p_fake >= 0.30:
            decision = "SUSPICIOUS_WARN"
            threat_level = "ELEVATED"
            badge_color = "amber"
            action = "REQUIRE_STEP_UP_AUTH"
            if p_fake < 0.30 and has_claimed_identity and not is_matched:
                recommendation = (
                    f"Biometric Voice Mismatch: Audio is verified as authentic biological human speech, "
                    f"but voiceprint characteristics diverge from the enrolled profile of {claimed_speaker_name}. "
                    "Require secondary verification or step-up authentication."
                )
            else:
                recommendation = (
                    "Elevated Risk: Acoustic divergence or moderate synthetic anomalies detected. "
                    "Require secondary out-of-band MFA before granting authorization."
                )
        else:
            decision = "ALLOW_ACCESS"
            threat_level = "LOW"
            badge_color = "green"
            action = "GRANT_VOICE_ACCESS"
            recommendation = (
                "Voice Authentication Verified: Audio stream verified as authentic biological human speech "
                "with matching biometric voiceprint parameters."
            )

        alert_payload = {
            "alert_id": f"ALT-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "decision": decision,
            "threat_level": threat_level,
            "composite_risk_pct": round(composite_risk * 100, 1),
            "threat_vectors": threat_vectors,
            "claimed_identity": claimed_speaker_name or "Anonymous / Unspecified",
            "channels_notified": ["IN_APP_TOAST", "WEBSOCKET_DASHBOARD", "SIMULATED_SIEM_WEBHOOK", "SMS_DISPATCH"] if decision != "ALLOW_ACCESS" else ["IN_APP_TOAST"],
            "recommendation": recommendation
        }

        return {
            "risk_score": composite_risk,
            "risk_percentage": round(composite_risk * 100, 1),
            "decision": decision,
            "threat_level": threat_level,
            "badge_color": badge_color,
            "action": action,
            "recommendation": recommendation,
            "threat_vectors": threat_vectors,
            "alert": alert_payload
        }
