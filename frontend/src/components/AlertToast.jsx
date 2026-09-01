import React from 'react';
import { ShieldAlert, Check, X, ArrowRight } from 'lucide-react';

export default function AlertToast({ alert, onClose, onViewLedger }) {
  if (!alert) return null;

  const isBlock = alert.decision === 'BLOCK_AND_ALERT' || alert.threat_level === 'CRITICAL' || alert.severity === 'CRITICAL';
  const isWarn = alert.decision === 'SUSPICIOUS_WARN' || alert.threat_level === 'ELEVATED';

  let title = 'Voice Authentication Verified';
  let dotColor = 'bg-[#34C759]';

  if (isBlock) {
    title = 'Security Alert: Clone Attack Intercepted';
    dotColor = 'bg-[#FF3B30]';
  } else if (isWarn) {
    title = 'Warning: Voice Anomaly Detected';
    dotColor = 'bg-[#FF9500]';
  }

  return (
    <div className="fixed top-16 right-6 z-50 max-w-sm w-full animate-in slide-in-from-top-3 duration-250">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-4 border border-black/[0.08] shadow-apple-hover space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`}></span>
            <div>
              <h4 className="text-xs font-semibold text-[#1D1D1F]">
                {title}
              </h4>
              <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                {alert.message || alert.recommendation}
              </p>
              {alert.claimed_identity && (
                <div className="mt-1 text-[11px] text-[#86868B]">
                  Target identity: <span className="text-[#1D1D1F] font-medium">{alert.claimed_identity}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#86868B] hover:text-[#1D1D1F] p-1 rounded-full hover:bg-black/[0.04] transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {isBlock && onViewLedger && (
          <div className="pt-2 border-t border-black/[0.06] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#86868B]">Sealed to audit ledger</span>
            <button
              onClick={onViewLedger}
              className="inline-flex items-center space-x-1 text-[#0071E3] hover:underline font-medium text-xs"
            >
              <span>View ledger block</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
