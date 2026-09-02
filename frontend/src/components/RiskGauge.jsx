import React from 'react';

export default function RiskGauge({
  riskScore = 0.0,
  decision = 'ALLOW_ACCESS',
  deepfakeScore = 0.0,
  verificationScore = 0.0,
  subScores = {},
  isLive = false,
  claimedIdentity = '',
}) {
  const riskPct = Math.round(riskScore * 100);
  const deepfakePct = Math.round(deepfakeScore * 100);
  const verifyPct = Math.round(verificationScore * 100);

  const isBlocked = decision === 'BLOCK_AND_ALERT' || riskScore >= 0.65 || deepfakeScore >= 0.65;
  const isWarn = decision === 'SUSPICIOUS_WARN' || (riskScore >= 0.35 && !isBlocked);

  const targetName = claimedIdentity && claimedIdentity !== 'ALL' ? claimedIdentity : 'enrolled speaker';

  return (
    <div className="space-y-6 sm:space-y-7 pb-1">
      {/* Hero Decision Moment */}
      <div>
        <div className="inline-flex items-center space-x-2 text-xs text-[#86868B] mb-2 font-medium">
          {isLive && (
            <span className="flex items-center space-x-1.5 text-[#FF3B30]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse"></span>
              <span>Live stream</span>
            </span>
          )}
          {!isLive && <span>Security decision</span>}
        </div>

        {isBlocked ? (
          <div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#FF3B30] leading-tight">
              Clone attack intercepted.
            </h2>
            <p className="text-[#86868B] text-base sm:text-lg mt-2 leading-relaxed font-normal max-w-xl">
              Synthetic vocoder artifacts detected. The audio does not originate from the natural voiceprint of {targetName}.
            </p>
          </div>
        ) : isWarn ? (
          <div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#FF9500] leading-tight">
              Identity review required.
            </h2>
            <p className="text-[#86868B] text-base sm:text-lg mt-2 leading-relaxed font-normal max-w-xl">
              Voice characteristics show acoustic divergence from the registered biometric profile of {targetName}.
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#34C759] leading-tight">
              Authentic voice verified.
            </h2>
            <p className="text-[#86868B] text-base sm:text-lg mt-2 leading-relaxed font-normal max-w-xl">
              Natural biological vocal cadence confirmed. Zero synthetic vocoder artifacts detected in audio stream.
            </p>
          </div>
        )}
      </div>

      {/* Apple-Style Specs Grid (Big numbers, small gray captions) */}
      <div className="grid grid-cols-3 gap-6 pt-5 border-t border-black/[0.06]">
        <div>
          <div className="text-3xl sm:text-4xl font-light tracking-tight text-[#1D1D1F] leading-none mb-1.5">
            {verifyPct}%
          </div>
          <div className="text-xs text-[#86868B] font-normal leading-normal">
            Voiceprint match
          </div>
        </div>

        <div>
          <div className={`text-3xl sm:text-4xl font-light tracking-tight leading-none mb-1.5 ${isBlocked ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>
            {deepfakePct}%
          </div>
          <div className="text-xs text-[#86868B] font-normal leading-normal">
            Deepfake probability
          </div>
        </div>

        <div>
          <div className="text-3xl sm:text-4xl font-light tracking-tight text-[#1D1D1F] leading-none mb-1.5">
            {riskPct}%
          </div>
          <div className="text-xs text-[#86868B] font-normal leading-normal">
            Anomaly score
          </div>
        </div>
      </div>

      {/* Acoustic Sub-Metrics in Quiet Row with ample bottom padding */}
      {subScores && Object.keys(subScores).length > 0 && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-4 border-t border-black/[0.06] text-xs text-[#86868B]">
          <div>
            <span className="text-[#1D1D1F] font-medium mr-1.5">
              {Math.round((subScores.vocoder_artifact_score || 0) * 100)}%
            </span>
            Vocoder cutoff
          </div>
          <div>
            <span className="text-[#1D1D1F] font-medium mr-1.5">
              {Math.round((subScores.pitch_monotonicity_score || 0) * 100)}%
            </span>
            Pitch variance
          </div>
          <div>
            <span className="text-[#1D1D1F] font-medium mr-1.5">
              {Math.round((subScores.micro_tremor_deficit_score || 0) * 100)}%
            </span>
            Micro-tremor
          </div>
        </div>
      )}
    </div>
  );
}
