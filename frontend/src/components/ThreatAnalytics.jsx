import React, { useState, useEffect } from 'react';
import { ChevronDown, Send, Check } from 'lucide-react';

export default function ThreatAnalytics() {
  const [incidents, setIncidents] = useState([]);
  const [filterDecision, setFilterDecision] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('https://security.apple.com/api/v1/voice-threats');
  const [webhookTestStatus, setWebhookTestStatus] = useState(null);

  // Policy Thresholds
  const [deepfakeWeight, setDeepfakeWeight] = useState(50);
  const [biometricWeight, setBiometricWeight] = useState(35);
  const [anomalyWeight, setAnomalyWeight] = useState(15);
  const [blockThreshold, setBlockThreshold] = useState(65);

  const fetchIncidents = async () => {
    try {
      const url = filterDecision ? `/api/incidents?decision_filter=${filterDecision}` : '/api/incidents';
      const res = await fetch(url);
      const data = await res.json();
      setIncidents(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [filterDecision]);

  const handleTestWebhook = () => {
    setWebhookTestStatus('SENDING');
    setTimeout(() => {
      setWebhookTestStatus('SUCCESS');
      setTimeout(() => setWebhookTestStatus(null), 3000);
    }, 600);
  };

  return (
    <div className="space-y-12 py-4">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-black/[0.06]">
        <div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F]">
            Threat Policies
          </h1>
          <p className="text-base sm:text-lg text-[#86868B] mt-2 font-normal max-w-2xl leading-relaxed">
            Configure risk decision weights, SIEM webhooks, and review previous authentication sessions.
          </p>
        </div>
      </div>

      {/* Grid: Sliders & Webhooks (Apple macOS Preferences Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sliders Card */}
        <div className="lg:col-span-6 apple-card p-8 space-y-6">
          <h2 className="text-lg font-semibold text-[#1D1D1F]">
            Risk Fusion Weights
          </h2>

          <div className="space-y-5 text-xs">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#1D1D1F] font-medium">Deepfake model weight</span>
                <span className="text-[#86868B]">{deepfakeWeight}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={deepfakeWeight}
                onChange={(e) => setDeepfakeWeight(Number(e.target.value))}
                className="w-full accent-[#0071E3] bg-[#E8E8ED] h-1 rounded-full cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#1D1D1F] font-medium">Biometric match weight</span>
                <span className="text-[#86868B]">{biometricWeight}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={biometricWeight}
                onChange={(e) => setBiometricWeight(Number(e.target.value))}
                className="w-full accent-[#0071E3] bg-[#E8E8ED] h-1 rounded-full cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#1D1D1F] font-medium">Acoustic anomaly weight</span>
                <span className="text-[#86868B]">{anomalyWeight}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={anomalyWeight}
                onChange={(e) => setAnomalyWeight(Number(e.target.value))}
                className="w-full accent-[#0071E3] bg-[#E8E8ED] h-1 rounded-full cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-black/[0.06]">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#1D1D1F] font-medium">Auto-block threshold</span>
                <span className="text-[#FF3B30] font-medium">≥ {blockThreshold}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="90"
                value={blockThreshold}
                onChange={(e) => setBlockThreshold(Number(e.target.value))}
                className="w-full accent-[#FF3B30] bg-[#E8E8ED] h-1 rounded-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Webhook & SIEM Card */}
        <div className="lg:col-span-6 apple-card p-8 space-y-6">
          <h2 className="text-lg font-semibold text-[#1D1D1F]">
            SIEM Webhook Integration
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[#86868B] mb-1.5 font-medium">Security webhook endpoint</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="flex-1 bg-[#F5F5F7] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3] font-mono"
                />
                <button
                  onClick={handleTestWebhook}
                  className="apple-btn-secondary text-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test</span>
                </button>
              </div>
            </div>

            {webhookTestStatus && (
              <div className="p-3 rounded-xl bg-[#34C759]/10 text-[#34C759] text-xs flex items-center space-x-2 font-medium">
                <Check className="w-4 h-4" />
                <span>Simulated SIEM dispatch confirmed (HTTP 200 OK).</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#F5F5F7] space-y-2 text-[#86868B] text-xs">
              <span className="text-[#1D1D1F] font-medium block">Included in payload:</span>
              <div>• Instant classification decision (Allow / Block)</div>
              <div>• 256-D voiceprint cosine similarity score</div>
              <div>• On-chain SHA-256 block hash and HMAC signature</div>
            </div>
          </div>
        </div>
      </div>

      {/* Incident History Table */}
      <div className="apple-card overflow-hidden">
        <div className="p-6 border-b border-black/[0.06] flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#1D1D1F]">
            Session Incident History
          </h3>

          <div className="relative">
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              className="appearance-none bg-[#E8E8ED] hover:bg-[#D2D2D7] text-[#1D1D1F] rounded-full pl-4 pr-9 py-1.5 text-xs font-medium focus:outline-none transition cursor-pointer"
            >
              <option value="">All events</option>
              <option value="BLOCK_AND_ALERT">Blocked only</option>
              <option value="SUSPICIOUS_WARN">Review required</option>
              <option value="ALLOW_ACCESS">Allowed only</option>
            </select>
            <ChevronDown className="w-3 h-3 text-[#86868B] absolute right-3.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div className="divide-y divide-black/[0.06]">
          {incidents.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#86868B]">
              No session records logged yet.
            </div>
          ) : (
            incidents.map((inc) => {
              const isBlocked = inc.decision === 'BLOCK_AND_ALERT';
              return (
                <div
                  key={inc.id}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAFAFC] transition text-xs"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-[#1D1D1F]">
                      {inc.claimed_identity}
                    </div>
                    <div className="text-xs text-[#86868B]">
                      Session ID: <span className="font-mono">{inc.id}</span> • {new Date(inc.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex items-center space-x-8">
                    <div>
                      <div className="text-[#86868B] text-[11px]">Deepfake prob</div>
                      <div className={`font-semibold text-sm ${inc.deepfake_score >= 0.6 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>
                        {Math.round(inc.deepfake_score * 100)}%
                      </div>
                    </div>

                    <div>
                      <div className="text-[#86868B] text-[11px]">Biometric match</div>
                      <div className="font-semibold text-sm text-[#1D1D1F]">
                        {Math.round(inc.verification_score * 100)}%
                      </div>
                    </div>

                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isBlocked
                          ? 'bg-[#FF3B30]/10 text-[#FF3B30]'
                          : inc.decision === 'SUSPICIOUS_WARN'
                          ? 'bg-[#FF9500]/10 text-[#FF9500]'
                          : 'bg-[#34C759]/10 text-[#34C759]'
                      }`}>
                        {inc.decision.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
