import React, { useState, useEffect, useRef } from 'react';
import { Mic, PhoneOff, ShieldCheck, ShieldAlert, ChevronDown, Info, Activity } from 'lucide-react';
import RiskGauge from './RiskGauge';
import WaveformVisualizer from './WaveformVisualizer';

// Fast autocorrelation pitch estimator for real-time vocal feedback
function detectPitchF0(buffer, sampleRate = 16000) {
  const SIZE = buffer.length;
  let sum = 0;
  for (let i = 0; i < SIZE; i++) sum += buffer[i] * buffer[i];
  const rms = Math.sqrt(sum / SIZE);
  if (rms < 0.015) return 0; // silence

  let r1 = 0, r2 = SIZE - 1;
  for (let i = 0; i < Math.min(SIZE, 128); i++) {
    if (Math.abs(buffer[i]) < 0.2) { r1 = i; break; }
  }
  for (let i = 1; i < Math.min(SIZE, 128); i++) {
    if (Math.abs(buffer[SIZE - i]) < 0.2) { r2 = SIZE - i; break; }
  }
  
  const trimmed = buffer.subarray(r1, r2);
  const len = trimmed.length;
  if (len < 64) return 0;

  let maxCorr = -1;
  let bestPeriod = -1;
  const minPeriod = Math.floor(sampleRate / 450); // max 450 Hz
  const maxPeriod = Math.floor(sampleRate / 75);  // min 75 Hz

  for (let period = minPeriod; period <= maxPeriod && period < len / 2; period++) {
    let corr = 0;
    for (let i = 0; i < len - period; i++) {
      corr += trimmed[i] * trimmed[i + period];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestPeriod = period;
    }
  }

  return bestPeriod > 0 ? Math.round(sampleRate / bestPeriod) : 0;
}

export default function LiveCallInterceptor({ speakers = [], onThreatDetected }) {
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [activeMode, setActiveMode] = useState(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState('ALL');
  const [selectionError, setSelectionError] = useState(false);
  
  // Real-time dynamic telemetry state (reacts continuously to microphone audio)
  const [liveRisk, setLiveRisk] = useState(0.06);
  const [liveDeepfake, setLiveDeepfake] = useState(0.04);
  const [liveVerifyMatch, setLiveVerifyMatch] = useState(0.92);
  const [liveDecision, setLiveDecision] = useState('ALLOW_ACCESS');
  const [liveSubScores, setLiveSubScores] = useState({
    vocoder_artifact_score: 0.04,
    pitch_monotonicity_score: 0.06,
    micro_tremor_deficit_score: 0.05,
  });
  const [liveChunkWaveform, setLiveChunkWaveform] = useState([]);
  const [livePitch, setLivePitch] = useState(185);
  const [telemetryLogs, setTelemetryLogs] = useState([]);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const simIntervalRef = useRef(null);
  const frameCountRef = useRef(0);
  const pitchHistoryRef = useRef([]);

  const getTargetName = () => {
    if (selectedSpeaker && selectedSpeaker !== 'ALL') {
      return selectedSpeaker;
    }
    return speakers[0]?.name || 'Alice Walker';
  };

  const getTargetDisplay = () => {
    if (selectedSpeaker && selectedSpeaker !== 'ALL') {
      return selectedSpeaker;
    }
    return 'Alice Walker (CFO)';
  };

  const addLog = (msg, level = 'INFO') => {
    const ts = new Date().toLocaleTimeString();
    setTelemetryLogs((prev) => [
      { id: Date.now() + Math.random(), msg: `[${ts}] ${msg}`, level, time: ts },
      ...prev.slice(0, 40)
    ]);
  };

  const connectWebSocket = (speakerName) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/live-call`;
    const target = speakerName || getTargetName();
    
    try {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        addLog(`Neural inference worker connected. Target: ${target}`, 'INFO');
        ws.send(JSON.stringify({ type: 'SET_SPEAKER', speaker_name: target }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'LIVE_TELEMETRY') {
            setLiveRisk(data.rolling_risk);
            setLiveDeepfake(data.deepfake_score);
            if (data.match_confidence !== undefined) {
              setLiveVerifyMatch(data.match_confidence);
            }
            setLiveDecision(data.instant_decision);
            setLiveSubScores(data.sub_scores || {});
            if (data.telemetry?.pitch_mean_hz) {
              setLivePitch(data.telemetry.pitch_mean_hz);
            }
            if (data.waveform_chunk) {
              setLiveChunkWaveform(data.waveform_chunk);
            }

            const matchPct = Math.round((data.match_confidence ?? 0.9) * 100);
            const riskPct = data.rolling_risk_pct;
            const fakePct = data.deepfake_score_pct;
            const logMsg = `Telemetry: Match ${matchPct}% • Deepfake ${fakePct}% • Risk ${riskPct}% • ${data.instant_decision}`;
            addLog(logMsg, data.instant_decision === 'BLOCK_AND_ALERT' ? 'DANGER' : data.instant_decision === 'SUSPICIOUS_WARN' ? 'WARN' : 'INFO');
          } else if (data.type === 'ALERT_BREACH') {
            addLog(`CRITICAL: Neural vocoder clone attack intercepted against ${target}!`, 'ALERT');
            if (onThreatDetected) {
              onThreatDetected({
                decision: 'BLOCK_AND_ALERT',
                threat_level: 'CRITICAL',
                message: data.message || `Synthetic clone attack detected against ${target}.`,
                risk_pct: data.risk_pct || 92,
                claimed_identity: target,
              });
            }
          }
        } catch (err) {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {};

      wsRef.current = ws;
    } catch (e) {}
  };

  const startMicIntercept = async () => {
    const target = getTargetName();
    setSelectionError(false);
    frameCountRef.current = 0;
    pitchHistoryRef.current = [];

    try {
      connectWebSocket(target);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        frameCountRef.current++;
        
        // 1. Calculate live audio RMS (energy)
        let sumSquares = 0;
        let zeroCrossings = 0;
        const pcm16 = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          sumSquares += s * s;
          if (i > 0 && ((inputData[i] >= 0 && inputData[i - 1] < 0) || (inputData[i] < 0 && inputData[i - 1] >= 0))) {
            zeroCrossings++;
          }
        }
        
        const rms = Math.sqrt(sumSquares / inputData.length);
        const zcr = zeroCrossings / inputData.length;

        // 2. Real-time F0 pitch extraction
        const detectedF0 = detectPitchF0(inputData, 16000);
        if (detectedF0 > 60 && detectedF0 < 450) {
          setLivePitch(detectedF0);
          pitchHistoryRef.current.push(detectedF0);
          if (pitchHistoryRef.current.length > 20) pitchHistoryRef.current.shift();
        }

        // 3. Dynamic Waveform visualization
        const chunk = Array.from({ length: 24 }, (_, idx) => {
          const val = Math.abs(inputData[Math.floor(idx * (inputData.length / 24))]);
          return Math.min(1.0, Math.max(0.08, val * 6 + rms * 3));
        });
        setLiveChunkWaveform(chunk);

        // 4. Send live PCM audio chunk to backend WebSocket for deep neural & forensic analysis
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsIntercepting(true);
      setActiveMode('MIC');
      addLog(`Microphone audio stream active. Speak to analyze voiceprint against ${target}...`, 'INFO');
    } catch (err) {
      addLog(`Microphone access error: ${err.message}`, 'WARN');
    }
  };

  const startSimulation = (mode) => {
    const target = getTargetName();
    setSelectionError(false);

    stopIntercept();
    setIsIntercepting(true);
    setActiveMode(mode);

    addLog(
      mode === 'SIMULATE_CLONE'
        ? `Simulating synthetic voice clone attack against ${target}...`
        : `Simulating authentic speaker call (${target})...`,
      mode === 'SIMULATE_CLONE' ? 'ALERT' : 'INFO'
    );

    let frame = 0;
    simIntervalRef.current = setInterval(() => {
      frame++;
      if (mode === 'SIMULATE_CLONE') {
        const fakeRisk = Math.min(0.94, 0.52 + frame * 0.08 + Math.random() * 0.04);
        const fakeScore = Math.min(0.96, 0.62 + frame * 0.07 + Math.random() * 0.03);
        const fakeMatch = Math.max(0.12, 0.28 - frame * 0.03);

        setLiveRisk(fakeRisk);
        setLiveDeepfake(fakeScore);
        setLiveVerifyMatch(fakeMatch);
        setLiveDecision('BLOCK_AND_ALERT');
        setLivePitch(192 + (frame % 2) * 4);
        setLiveSubScores({
          vocoder_artifact_score: 0.89,
          pitch_monotonicity_score: 0.94,
          micro_tremor_deficit_score: 0.88,
        });
        setLiveChunkWaveform(Array.from({ length: 30 }, () => Math.random() * 0.7 + 0.25));

        const riskPct = Math.round(fakeRisk * 100);
        const deepfakePct = Math.round(fakeScore * 100);
        addLog(`Telemetry: Match ${Math.round(fakeMatch * 100)}% • Deepfake ${deepfakePct}% • Risk ${riskPct}% • BLOCK_AND_ALERT`, 'DANGER');

        if (frame === 3) {
          addLog(`CRITICAL: Neural vocoder clone attack intercepted against ${target}!`, 'ALERT');
          if (onThreatDetected) {
            onThreatDetected({
              decision: 'BLOCK_AND_ALERT',
              threat_level: 'CRITICAL',
              message: `Live synthetic voice clone attack intercepted against ${target}.`,
              risk_pct: riskPct,
              claimed_identity: target,
            });
          }
        }
      } else {
        const realRisk = Math.max(0.04, 0.07 + Math.sin(frame * 0.5) * 0.03);
        const realDeepfake = Math.max(0.02, 0.05 + Math.sin(frame * 0.3) * 0.02);
        const realMatch = Math.min(0.98, 0.92 + Math.sin(frame * 0.4) * 0.04);

        setLiveRisk(realRisk);
        setLiveDeepfake(realDeepfake);
        setLiveVerifyMatch(realMatch);
        setLiveDecision('ALLOW_ACCESS');
        setLivePitch(180 + Math.sin(frame * 0.4) * 22);
        setLiveSubScores({
          vocoder_artifact_score: 0.04,
          pitch_monotonicity_score: 0.07,
          micro_tremor_deficit_score: 0.04,
        });
        setLiveChunkWaveform(Array.from({ length: 30 }, () => Math.random() * 0.45 + 0.15));

        const riskPct = Math.round(realRisk * 100);
        const deepfakePct = Math.round(realDeepfake * 100);
        addLog(`Telemetry: Match ${Math.round(realMatch * 100)}% • Deepfake ${deepfakePct}% • Risk ${riskPct}% • ALLOW_ACCESS`, 'INFO');
      }
    }, 650);
  };

  const stopIntercept = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsIntercepting(false);
    setActiveMode(null);
    addLog('Stream closed.', 'INFO');
  };

  return (
    <div className="space-y-12 py-4">
      {/* Editorial Header & Action Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-black/[0.06]">
        <div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F]">
            Live Call Interceptor
          </h1>
          <p className="text-base sm:text-lg text-[#86868B] mt-2 font-normal max-w-2xl leading-relaxed">
            Real-time biometric authentication and neural vocoder analysis for telephonic and VOIP voice calls.
          </p>
        </div>

        {/* Identity Selector & Stream Trigger */}
        <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-3">
            {/* Identity Dropdown */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-1.5 text-xs text-[#86868B] font-medium mb-1">
                <span>Verifying against</span>
              </div>
              <div className="relative">
                <select
                  value={selectedSpeaker}
                  onChange={(e) => {
                    setSelectedSpeaker(e.target.value);
                    setSelectionError(false);
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'SET_SPEAKER', speaker_name: e.target.value }));
                    }
                  }}
                  className={`appearance-none rounded-full pl-4 pr-9 py-2 text-sm font-medium focus:outline-none transition cursor-pointer ${
                    !selectedSpeaker
                      ? 'bg-[#E8E8ED] text-[#1D1D1F]'
                      : 'bg-[#E8E8ED] hover:bg-[#D2D2D7] text-[#1D1D1F]'
                  } ${selectionError ? 'ring-2 ring-[#FF3B30] bg-[#FF3B30]/5 text-[#1D1D1F]' : ''}`}
                >
                  <option value="ALL">
                    Auto-Detect / General Voice Mode
                  </option>
                  <option value="Alice Walker">
                    Alice Walker (CFO) — Biometric Verification
                  </option>
                  {speakers.length > 0 &&
                    speakers
                      .filter((s) => s.name !== "Alice Walker")
                      .map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.role.split(' ')[0]}) — Biometric Verification
                        </option>
                      ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Action Trigger */}
            <div className="flex flex-col self-end">
              {!isIntercepting ? (
                <button
                  onClick={startMicIntercept}
                  className="apple-btn-primary"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start microphone</span>
                </button>
              ) : (
                <button
                  onClick={stopIntercept}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium bg-[#FF3B30] text-white hover:opacity-90 transition active:scale-95"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End stream</span>
                </button>
              )}
            </div>
          </div>

          {/* Helper line underneath identity selector */}
          <div className="flex items-center space-x-1.5 text-xs text-[#86868B]">
            <Info className="w-3.5 h-3.5 shrink-0 text-[#86868B]" />
            <span>
              {selectionError ? (
                <strong className="text-[#FF3B30]">Please select a voiceprint to verify against first.</strong>
              ) : (
                'The system checks whether the incoming voice matches this enrolled voiceprint.'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Decision Hero & Waveform */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Hero Decision & Presets */}
        <div className="lg:col-span-6 space-y-8">
          <div className="apple-card p-8 sm:p-9">
            <RiskGauge
              riskScore={liveRisk}
              decision={liveDecision}
              deepfakeScore={liveDeepfake}
              verificationScore={liveVerifyMatch}
              subScores={liveSubScores}
              isLive={isIntercepting}
              claimedIdentity={getTargetName()}
            />
          </div>

          {/* Quiet Simulation Toggles */}
          <div className="space-y-3">
            <span className="text-xs text-[#86868B] font-medium block">
              Simulation presets
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => startSimulation('SIMULATE_REAL')}
                className={`p-4 rounded-2xl border text-left transition ${
                  activeMode === 'SIMULATE_REAL'
                    ? 'bg-white border-[#34C759] shadow-sm ring-1 ring-[#34C759]'
                    : 'bg-white border-black/[0.06] hover:border-black/[0.12]'
                }`}
              >
                <div className="text-sm font-semibold text-[#1D1D1F] flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#34C759]" />
                  <span>Authorized voice</span>
                </div>
                <div className="text-xs text-[#86868B] mt-1">
                  Authentic vocal tract of {getTargetDisplay()}
                </div>
              </button>

              <button
                onClick={() => startSimulation('SIMULATE_CLONE')}
                className={`p-4 rounded-2xl border text-left transition ${
                  activeMode === 'SIMULATE_CLONE'
                    ? 'bg-white border-[#FF3B30] shadow-sm ring-1 ring-[#FF3B30]'
                    : 'bg-white border-black/[0.06] hover:border-black/[0.12]'
                }`}
              >
                <div className="text-sm font-semibold text-[#FF3B30] flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#FF3B30]" />
                  <span>Synthetic clone</span>
                </div>
                <div className="text-xs text-[#86868B] mt-1">
                  Neural vocoder impersonation of {getTargetDisplay()}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Waveform & Console Logs */}
        <div className="lg:col-span-6 space-y-8">
          <WaveformVisualizer
            isLive={true}
            liveChunk={liveChunkWaveform}
            f0Hz={livePitch}
          />

          {/* macOS Console Style Log Stream */}
          <div className="apple-card p-8 space-y-4">
            <div className="flex items-center justify-between text-xs text-[#86868B] border-b border-black/[0.06] pb-3">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-[#1D1D1F]">Live telemetry stream</span>
                {isIntercepting && (
                  <span className="inline-flex items-center space-x-1 text-[11px] text-[#34C759]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse"></span>
                    <span>Active</span>
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px]">16 kHz PCM</span>
            </div>

            <div className="h-48 overflow-y-auto font-mono text-xs space-y-1.5 text-[#86868B] pr-2">
              {telemetryLogs.length === 0 ? (
                <div className="text-center py-16 font-sans text-xs text-[#86868B]">
                  Stream idle. Select an enrolled identity and tap "Start microphone" or a simulation preset below.
                </div>
              ) : (
                telemetryLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`leading-relaxed text-[11px] ${
                      log.level === 'ALERT'
                        ? 'text-[#FF3B30] font-medium'
                        : log.level === 'DANGER'
                        ? 'text-[#FF3B30]'
                        : log.level === 'WARN'
                        ? 'text-[#FF9500]'
                        : 'text-[#1D1D1F]'
                    }`}
                  >
                    {log.msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
