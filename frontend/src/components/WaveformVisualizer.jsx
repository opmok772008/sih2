import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export default function WaveformVisualizer({
  audioUrl,
  waveformPoints = [],
  spectrogram = [],
  isLive = false,
  liveChunk = [],
  f0Hz = 0,
}) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    let points = waveformPoints;
    if (isLive && liveChunk.length > 0) {
      points = liveChunk;
    }

    if (points.length === 0) {
      points = Array.from({ length: 90 }, (_, i) => Math.sin(i * 0.18) * 0.35 + 0.15);
    }

    ctx.clearRect(0, 0, width, height);

    const numBars = points.length;
    const barWidth = Math.max(2.5, (width / numBars) - 2);
    
    const progress = duration > 0 ? (currentTime / duration) : 0;
    const activeBarIdx = Math.floor(progress * numBars);

    points.forEach((val, idx) => {
      const x = idx * (barWidth + 2);
      const barHeight = Math.max(4, Math.min(height * 0.85, val * height * 0.85));
      const y = (height - barHeight) / 2;

      const isPast = !isLive && idx <= activeBarIdx;
      
      // Apple Voice Memos Palette: #0071E3 for played, #D2D2D7 for upcoming, #1D1D1F for live
      if (isLive) {
        ctx.fillStyle = '#1D1D1F';
      } else if (isPast) {
        ctx.fillStyle = '#0071E3';
      } else {
        ctx.fillStyle = '#D2D2D7';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
    });
  }, [waveformPoints, liveChunk, isLive, currentTime, duration]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioRef.current || isLive || duration === 0) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = pct * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="apple-card p-8 space-y-5">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
          onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        />
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between text-xs text-[#86868B]">
        <div className="font-medium text-[#1D1D1F]">
          {isLive ? 'Live microphone stream' : 'Acoustic waveform'}
        </div>
        <div className="flex items-center space-x-4">
          {f0Hz > 0 && (
            <span>
              Pitch: <strong className="font-medium text-[#1D1D1F]">{Math.round(f0Hz)} Hz</strong>
            </span>
          )}
          {!isLive && duration > 0 && (
            <span className="font-mono text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
        </div>
      </div>

      {/* Waveform Canvas */}
      <div 
        className="w-full bg-[#F5F5F7] rounded-xl p-3 cursor-pointer select-none"
        onClick={handleSeek}
      >
        <canvas
          ref={canvasRef}
          width={640}
          height={72}
          className="w-full h-16 block"
        />
      </div>

      {/* Apple Audio Controls */}
      {!isLive && audioUrl && (
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center hover:opacity-90 transition active:scale-95 shadow-sm"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
              }}
              className="w-8 h-8 rounded-full bg-[#E8E8ED] text-[#1D1D1F] flex items-center justify-center hover:bg-[#D2D2D7] transition active:scale-95"
              title="Restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-xs text-[#86868B] select-none">
            Tap waveform to scrub
          </span>
        </div>
      )}

      {/* Mel-Spectrogram Density Strip */}
      {spectrogram && spectrogram.length > 0 && (
        <div className="pt-3 border-t border-black/[0.06] space-y-1.5">
          <div className="flex justify-between text-[11px] text-[#86868B]">
            <span>128-band Mel spectrogram</span>
            <span>0 Hz – 8 kHz</span>
          </div>
          <div className="grid grid-cols-20 gap-0.5 h-8 bg-[#F5F5F7] p-1 rounded-lg overflow-hidden">
            {spectrogram.map((row, rIdx) => (
              <div key={rIdx} className="flex flex-col gap-0.5 h-full flex-1">
                {row.map((val, cIdx) => {
                  const intensity = Math.max(0, Math.min(1, val));
                  return (
                    <div
                      key={cIdx}
                      className="flex-1 rounded-[1px]"
                      style={{
                        backgroundColor: `rgba(29, 29, 31, ${0.08 + intensity * 0.85})`
                      }}
                    ></div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
