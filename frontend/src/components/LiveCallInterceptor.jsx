import React, { useState, useEffect, useRef } from 'react';
import { Mic, PhoneOff, ShieldCheck, ShieldAlert, ChevronDown, Info } from 'lucide-react';
import RiskGauge from './RiskGauge';
import WaveformVisualizer from './WaveformVisualizer';

export default function LiveCallInterceptor({ speakers = [], onThreatDetected }) {
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [activeMode, setActiveMode] = useState(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [selectionError, setSelectionError] = useState(false);
  
  // Real-time telemetry state
  const [liveRisk, setLiveRisk] = useState(0.08);
  const [liveDeepfake, setLiveDeepfake] = useState(0.05);
  const [liveDecision, setLiveDecision] = useState('ALLOW_ACCESS');
  const [liveSubScores, setLiveSubScores] = useState({
    vocoder_artifact_score: 0.04,
    pitch_monotonicity_score: 0.08,
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

  const connectWebSocket = (speakerName) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-call`;
    const target = speakerName || selectedSpeaker || 'Alice Walker';
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        addLog('Connected to inference worker.', 'INFO');
        ws.send(JSON.stringify({ type: 'SET_SPEAKER', speaker_name: target }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'LIVE_TELEMETRY') {
            setLiveRisk(data.rolling_risk);
            setLiveDeepfake(data.deepfake_score);
            setLiveDecision(data.instant_decision);
            setLiveSubScores(data.sub_scores || {});
            setLivePitch(data.telemetry?.pitch_mean_hz || 0);
            if (data.waveform_chunk) {
              setLiveChunkWaveform(data.waveform_chunk);
            }

            const ts = new Date().toLocaleTimeString();
            const logMsg = `[${ts}] Risk: ${data.rolling_risk_pct}% • Deepfake: ${data.deepfake_score_pct}% • Decision: ${data.instant_decision}`;
            addLog(logMsg, data.instant_decision === 'BLOCK_AND_ALERT' ? 'DANGER' : data.instant_decision === 'SUSPICIOUS_WARN' ? 'WARN' : 'INFO');
          } else if (data.type === 'ALERT_BREACH') {
            addLog(`Alert: Synthetic voice clone attack detected in stream.`, 'ALERT');
            if (onThreatDetected) {
              onThreatDetected({
                decision: 'BLOCK_AND_ALERT',
                threat_level: 'CRITICAL',
                message: data.message,
                risk_pct: data.risk_pct,
                claimed_identity: target,
              });
            }
          }
        } catch (err) {}
      };

      ws.onerror = () => {
        addLog('WebSocket connection unavailable.', 'WARN');
      };

      ws.onclose = () => {
        addLog('Stream disconnected.', 'INFO');
      };

      wsRef.current = ws;
    } catch (e) {
      addLog('Could not connect to WebSocket. Using client simulator.', 'WARN');
    }
  };

  const addLog = (msg, level = 'INFO') => {
    setTelemetryLogs((prev) => [
      { id: Date.now() + Math.random(), msg, level, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 30)
    ]);
  };

  const startMicIntercept = async () => {
    if (!selectedSpeaker) {
      setSelectionError(true);
      return;
    }
    setSelectionError(false);

    try {
      connectWebSocket(selectedSpeaker);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        wsRef.current.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsIntercepting(true);
      setActiveMode('MIC');
      addLog(`Live microphone active. Evaluating against ${selectedSpeaker}`, 'INFO');
    } catch (err) {
      addLog(`Microphone access error: ${err.message}`, 'WARN');
    }
  };

  const startSimulation = (mode) => {
    const target = selectedSpeaker || (speakers[0]?.name || 'Alice Walker');
    if (!selectedSpeaker) {
      setSelectedSpeaker(target);
    }
    setSelectionError(false);

    stopIntercept();
    connectWebSocket(target);
    setIsIntercepting(true);
    setActiveMode(mode);

    addLog(
      mode === 'SIMULATE_CLONE'
        ? `Simulating synthetic voice clone attack against ${target}...`
        : `Simulating authorized caller stream (${target})...`,
      mode === 'SIMULATE_CLONE' ? 'ALERT' : 'INFO'
    );

    let frame = 0;
    simIntervalRef.current = setInterval(() => {
      frame++;
      if (mode === 'SIMULATE_CLONE') {
        const fakeRisk = Math.min(0.92, 0.45 + frame * 0.08 + Math.random() * 0.05);
        const fakeScore = Math.min(0.95, 0.55 + frame * 0.07 + Math.random() * 0.04);
        setLiveRisk(fakeRisk);
        setLiveDeepfake(fakeScore);
        setLiveDecision('BLOCK_AND_ALERT');
        setLivePitch(190 + (frame % 2) * 5);
        setLiveSubScores({
          vocoder_artifact_score: 0.88,
          pitch_monotonicity_score: 0.92,
          micro_tremor_deficit_score: 0.85,
        });
        setLiveChunkWaveform(Array.from({ length: 30 }, () => Math.random() * 0.7 + 0.2));

        if (frame >= 3 && frame <= 4) {
          if (onThreatDetected) {
            onThreatDetected({
              decision: 'BLOCK_AND_ALERT',
              threat_level: 'CRITICAL',
              message: `Live synthetic voice clone attack intercepted against ${target}.`,
              risk_pct: Math.round(fakeRisk * 100),
              claimed_identity: target,
            });
          }
        }
      } else {
        const realRisk = Math.max(0.04, 0.09 + Math.sin(frame * 0.5) * 0.03);
        const realDeepfake = Math.max(0.02, 0.08 + Math.sin(frame * 0.3) * 0.03);
        setLiveRisk(realRisk);
        setLiveDeepfake(realDeepfake);
        setLiveDecision('ALLOW_ACCESS');
        setLivePitch(180 + Math.sin(frame * 0.4) * 25);
        setLiveSubScores({
          vocoder_artifact_score: 0.05,
          pitch_monotonicity_score: 0.08,
          micro_tremor_deficit_score: 0.04,
        });
        setLiveChunkWaveform(Array.from({ length: 30 }, () => Math.random() * 0.5 + 0.1));
      }
    }, 600);
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
                      ? 'bg-[#E8E8ED] text-[#86868B] border border-dashed border-black/[0.15]'
                      : 'bg-[#E8E8ED] hover:bg-[#D2D2D7] text-[#1D1D1F]'
                  } ${selectionError ? 'ring-2 ring-[#FF3B30] bg-[#FF3B30]/5 text-[#1D1D1F]' : ''}`}
                >
                  <option value="" disabled>
                    Select a voiceprint to verify against
                  </option>
                  <option value="ALL">
                    Any enrolled voice (Auto-match)
                  </option>
                  {speakers.length > 0 ? (
                    speakers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.role.split(' ')[0]})
                      </option>
                    ))
                  ) : (
                    <option value="Alice Walker">Alice Walker (CFO)</option>
                  )}
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
              verificationScore={liveDecision === 'ALLOW_ACCESS' ? 0.94 : 0.28}
              subScores={liveSubScores}
              isLive={isIntercepting}
              claimedIdentity={selectedSpeaker}
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
                  Authentic vocal tract of {selectedSpeaker || 'Alice Walker'}
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
                  Neural vocoder impersonation of {selectedSpeaker || 'Alice Walker'}
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
              <span className="font-medium text-[#1D1D1F]">Live telemetry stream</span>
              <span className="font-mono text-[11px]">16 kHz PCM</span>
            </div>

            <div className="h-48 overflow-y-auto font-mono text-xs space-y-1.5 text-[#86868B] pr-2">
              {telemetryLogs.length === 0 ? (
                <div className="text-center py-16 font-sans text-xs text-[#86868B]">
                  Stream idle. Choose an identity above and tap "Start microphone" or a simulation preset.
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
