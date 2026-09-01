import React, { useState, useEffect } from 'react';
import { Upload, ChevronDown } from 'lucide-react';
import WaveformVisualizer from './WaveformVisualizer';
import RiskGauge from './RiskGauge';
import RadarChart from './RadarChart';

export default function ForensicAudioLab({ speakers = [], samples = [], onAnalysisComplete, onThreatDetected }) {
  const [selectedSample, setSelectedSample] = useState(samples[0]?.id || 'alice_real');
  const [claimedSpeaker, setClaimedSpeaker] = useState('Alice Walker');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStageTab, setActiveStageTab] = useState('stage4');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [audioPlayUrl, setAudioPlayUrl] = useState('/static/samples/alice_real_authorized.wav');

  useEffect(() => {
    if (samples.length > 0 && !selectedSample) {
      setSelectedSample(samples[0].id);
      setAudioPlayUrl(samples[0].audio_url);
    }
  }, [samples]);

  const handleSelectSample = (sample) => {
    setSelectedSample(sample.id);
    setUploadedFile(null);
    setAudioPlayUrl(sample.audio_url);
    setClaimedSpeaker(sample.speaker_name || 'Alice Walker');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      setSelectedSample(null);
      setAudioPlayUrl(URL.createObjectURL(file));
    }
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      if (uploadedFile) {
        formData.append('audio_file', uploadedFile);
      } else if (selectedSample) {
        formData.append('sample_id', selectedSample);
      }
      formData.append('claimed_identity', claimedSpeaker);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setAnalysisResult(data);
      if (onAnalysisComplete) onAnalysisComplete(data);

      if (data.stage4_risk_decision?.decision === 'BLOCK_AND_ALERT' && onThreatDetected) {
        onThreatDetected({
          decision: 'BLOCK_AND_ALERT',
          threat_level: 'CRITICAL',
          message: data.stage4_risk_decision.recommendation,
          risk_pct: data.stage4_risk_decision.risk_percentage,
          claimed_identity: claimedSpeaker,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!analysisResult && (selectedSample || samples.length > 0)) {
      runAnalysis();
    }
  }, [samples]);

  return (
    <div className="space-y-12 py-4">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-black/[0.06]">
        <div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F]">
            Forensic Analysis
          </h1>
          <p className="text-base sm:text-lg text-[#86868B] mt-2 font-normal max-w-2xl leading-relaxed">
            Examine audio recordings across acoustic preprocessing, neural vocoder spoof detection, and biometric embedding comparisons.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Identity Select */}
          <div className="relative">
            <select
              value={claimedSpeaker}
              onChange={(e) => setClaimedSpeaker(e.target.value)}
              className="appearance-none bg-[#E8E8ED] hover:bg-[#D2D2D7] text-[#1D1D1F] rounded-full pl-4 pr-9 py-2 text-sm font-medium focus:outline-none transition cursor-pointer"
            >
              {speakers.length > 0 ? (
                speakers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.role.split(' ')[0]})
                  </option>
                ))
              ) : (
                <option value="Alice Walker">Alice Walker (CFO)</option>
              )}
              <option value="Unknown Caller">Unknown Caller</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-3.5 top-3 pointer-events-none" />
          </div>

          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="apple-btn-primary disabled:opacity-50"
          >
            {isAnalyzing ? 'Analyzing...' : 'Run analysis'}
          </button>
        </div>
      </div>

      {/* Test Scenarios Grid (Apple Product Cards with Equal Height & Consistent Badges) */}
      <div className="space-y-3">
        <span className="text-xs text-[#86868B] font-medium block">
          Evaluation audio samples
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {samples.map((s) => {
            const isSelected = selectedSample === s.id && !uploadedFile;
            const isBlock = s.expected_outcome === 'BLOCK_AND_ALERT';
            const isWarn = s.expected_outcome === 'SUSPICIOUS_WARN';
            return (
              <button
                key={s.id}
                onClick={() => handleSelectSample(s)}
                className={`min-h-[124px] p-5 rounded-2xl border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white border-[#0071E3] ring-1 ring-[#0071E3] shadow-sm'
                    : 'bg-white border-black/[0.08] hover:border-black/[0.16] hover:bg-[#FAFAFC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-semibold text-sm text-[#1D1D1F] truncate">
                    {s.title.split(':')[0]}
                  </span>
                  <span
                    className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium leading-none tracking-normal shrink-0 ${
                      isBlock
                        ? 'bg-[#FF3B30]/10 text-[#C41C14]'
                        : isWarn
                        ? 'bg-[#FF9500]/10 text-[#9E5D00]'
                        : 'bg-[#34C759]/10 text-[#1C7D38]'
                    }`}
                  >
                    {isBlock ? 'Attack' : isWarn ? 'Mismatch' : 'Authentic'}
                  </span>
                </div>
                <p className="text-xs text-[#86868B] leading-relaxed line-clamp-2">
                  {s.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Custom Upload Strip */}
        <div className="pt-2 flex items-center justify-between text-xs text-[#86868B]">
          <label className="inline-flex items-center space-x-1.5 text-[#0071E3] hover:underline cursor-pointer font-medium">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload custom audio file (.wav, .mp3, .m4a)</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          {uploadedFile && (
            <span className="text-[#1D1D1F] font-medium">
              {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>
      </div>

      {/* Main Results Showcase */}
      {analysisResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Decision & Biometric Radar */}
          <div className="lg:col-span-6 space-y-8">
            <div className="apple-card p-8 sm:p-9">
              <RiskGauge
                riskScore={analysisResult.stage4_risk_decision?.risk_score || 0.0}
                decision={analysisResult.stage4_risk_decision?.decision || 'ALLOW_ACCESS'}
                deepfakeScore={analysisResult.stage2_deepfake?.deepfake_score || 0.0}
                verificationScore={analysisResult.stage3_verification?.match_confidence || 0.0}
                subScores={analysisResult.stage2_deepfake?.sub_scores || {}}
              />
            </div>

            <RadarChart
              queryProfile={analysisResult.biometrics?.query_radar}
              targetProfile={analysisResult.biometrics?.target_radar}
              queryLabel="Sample Audio"
              targetLabel={`Enrolled: ${claimedSpeaker}`}
            />
          </div>

          {/* Right Column: Waveform & 4-Stage Deep Dive Inspector */}
          <div className="lg:col-span-6 space-y-8">
            <WaveformVisualizer
              audioUrl={audioPlayUrl}
              waveformPoints={analysisResult.stage1_preprocessing?.waveform_preview || []}
              spectrogram={analysisResult.stage1_preprocessing?.spectrogram_preview || []}
              f0Hz={analysisResult.stage1_preprocessing?.telemetry?.pitch_mean_hz || 0}
            />

            {/* Apple Segmented 4-Stage Deep Dive */}
            <div className="apple-card p-8 space-y-6">
              {/* Segmented Control */}
              <div className="flex bg-[#E8E8ED] p-1 rounded-full text-xs">
                {[
                  { id: 'stage1', label: '1. Acoustics' },
                  { id: 'stage2', label: '2. Deepfake AI' },
                  { id: 'stage3', label: '3. Biometrics' },
                  { id: 'stage4', label: '4. Audit Ledger' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveStageTab(tab.id)}
                    className={`flex-1 py-1.5 rounded-full font-medium transition text-center ${
                      activeStageTab === tab.id
                        ? 'bg-white text-[#1D1D1F] shadow-sm font-semibold'
                        : 'text-[#86868B] hover:text-[#1D1D1F]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeStageTab === 'stage1' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-2xl sm:text-3xl font-light text-[#1D1D1F]">
                        {analysisResult.stage1_preprocessing?.sample_rate} Hz
                      </div>
                      <div className="text-xs text-[#86868B] mt-1 font-normal">
                        Sampling rate
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-light text-[#1D1D1F]">
                        {analysisResult.stage1_preprocessing?.duration}s
                      </div>
                      <div className="text-xs text-[#86868B] mt-1 font-normal">
                        Duration (VAD)
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-light text-[#1D1D1F]">
                        {analysisResult.stage1_preprocessing?.telemetry?.pitch_mean_hz} Hz
                      </div>
                      <div className="text-xs text-[#86868B] mt-1 font-normal">
                        Fundamental pitch (F0)
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-black/[0.06]">
                    <div>
                      <div className="text-2xl sm:text-3xl font-light text-[#1D1D1F]">
                        {analysisResult.stage1_preprocessing?.telemetry?.jitter_percent}%
                      </div>
                      <div className="text-xs text-[#86868B] mt-1 font-normal">
                        Cycle jitter
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-light text-[#1D1D1F]">
                        {analysisResult.stage1_preprocessing?.telemetry?.shimmer_percent}%
                      </div>
                      <div className="text-xs text-[#86868B] mt-1 font-normal">
                        Amplitude shimmer
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-light text-[#1D1D1F]">
                        {analysisResult.stage1_preprocessing?.telemetry?.spectral_rolloff_85_hz} Hz
                      </div>
                      <div className="text-xs text-[#86868B] mt-1 font-normal">
                        Spectral rolloff (85%)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeStageTab === 'stage2' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                    <div>
                      <span className="text-xs text-[#86868B]">Spoof classification</span>
                      <div className="text-lg font-semibold text-[#1D1D1F] mt-0.5">
                        {analysisResult.stage2_deepfake?.classification.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#86868B]">Neural confidence</span>
                      <div className="text-lg font-light text-[#1D1D1F] mt-0.5">
                        {Math.round(analysisResult.stage2_deepfake?.neural_model_score * 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-[#86868B] font-medium block">
                      Acoustic reasoning & telemetry:
                    </span>
                    <div className="space-y-1 text-xs text-[#1D1D1F] leading-relaxed">
                      {analysisResult.stage2_deepfake?.summary_reasoning?.map((r, i) => (
                        <p key={i}>• {r}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeStageTab === 'stage3' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 pb-3 border-b border-black/[0.06]">
                    <div>
                      <div className="text-2xl sm:text-3xl font-light text-[#1D1D1F]">
                        {analysisResult.stage3_verification?.cosine_similarity}
                      </div>
                      <div className="text-xs text-[#86868B] mt-1 font-normal">
                        Cosine similarity
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-light text-[#1D1D1F]">
                        {analysisResult.stage3_verification?.euclidean_distance}
                      </div>
                      <div className="text-xs text-[#86868B] mt-1 font-normal">
                        Euclidean distance
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#86868B] leading-relaxed">
                    Evaluated against 256-dimensional unit-normalized voiceprint of <strong>{claimedSpeaker}</strong>.
                  </p>
                </div>
              )}

              {activeStageTab === 'stage4' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#F5F5F7] space-y-1">
                    <div className="text-xs text-[#86868B]">Recommended response</div>
                    <div className="text-sm font-semibold text-[#1D1D1F]">
                      {analysisResult.stage4_risk_decision?.action.replace(/_/g, ' ')}
                    </div>
                    <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                      {analysisResult.stage4_risk_decision?.recommendation}
                    </p>
                  </div>

                  {analysisResult.blockchain_block && (
                    <div className="text-xs text-[#86868B] space-y-1 pt-2">
                      <div className="font-medium text-[#1D1D1F]">Audit Block #{analysisResult.blockchain_block.index}</div>
                      <div className="font-mono text-[11px] text-[#86868B] truncate">
                        SHA-256: {analysisResult.blockchain_block.block_hash}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
