import io
import os
import math
import numpy as np
import scipy.signal
import scipy.io.wavfile

try:
    import librosa
    import soundfile as sf
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False


class AudioPreprocessor:
    """
    Stage 1: Ingestion, Resampling, VAD/Silence Trimming, and Multi-Band Acoustic Feature Extraction.
    Standardizes audio to 16kHz mono and computes spectral, cepstral, and glottal/pitch metrics.
    """

    def __init__(self, target_sr: int = 16000):
        self.target_sr = target_sr

    def load_audio(self, audio_bytes_or_path, original_sr: int = None) -> tuple[np.ndarray, int]:
        """
        Load audio from bytes, file path, or numpy array and convert to 16kHz mono float32.
        """
        if isinstance(audio_bytes_or_path, (str, os.PathLike)):
            if HAS_LIBROSA:
                y, sr = librosa.load(audio_bytes_or_path, sr=self.target_sr, mono=True)
            else:
                sr, y = scipy.io.wavfile.read(audio_bytes_or_path)
                if y.dtype == np.int16:
                    y = y.astype(np.float32) / 32768.0
                elif y.dtype == np.int32:
                    y = y.astype(np.float32) / 2147483648.0
                if len(y.shape) > 1:
                    y = np.mean(y, axis=1)
                if sr != self.target_sr:
                    num_samples = int(len(y) * self.target_sr / sr)
                    y = scipy.signal.resample(y, num_samples)
                    sr = self.target_sr
        elif isinstance(audio_bytes_or_path, bytes):
            buffer = io.BytesIO(audio_bytes_or_path)
            if HAS_LIBROSA:
                try:
                    y, sr = sf.read(buffer, dtype="float32")
                    if len(y.shape) > 1:
                        y = np.mean(y, axis=1)
                    if sr != self.target_sr:
                        y = librosa.resample(y, orig_sr=sr, target_sr=self.target_sr)
                        sr = self.target_sr
                except Exception:
                    # Fallback to librosa.load with temp buffer or scipy
                    buffer.seek(0)
                    y, sr = librosa.load(buffer, sr=self.target_sr, mono=True)
            else:
                sr, y = scipy.io.wavfile.read(buffer)
                if y.dtype == np.int16:
                    y = y.astype(np.float32) / 32768.0
                if len(y.shape) > 1:
                    y = np.mean(y, axis=1)
                if sr != self.target_sr:
                    num_samples = int(len(y) * self.target_sr / sr)
                    y = scipy.signal.resample(y, num_samples)
                    sr = self.target_sr
        elif isinstance(audio_bytes_or_path, np.ndarray):
            y = audio_bytes_or_path.astype(np.float32)
            if len(y.shape) > 1:
                y = np.mean(y, axis=1)
            sr = original_sr or self.target_sr
            if sr != self.target_sr:
                if HAS_LIBROSA:
                    y = librosa.resample(y, orig_sr=sr, target_sr=self.target_sr)
                else:
                    num_samples = int(len(y) * self.target_sr / sr)
                    y = scipy.signal.resample(y, num_samples)
                sr = self.target_sr
        else:
            raise ValueError("Unsupported audio format type")

        # Peak normalization
        max_val = np.max(np.abs(y)) if len(y) > 0 else 0
        if max_val > 1e-6:
            y = y / max_val * 0.95

        # Voice Activity Detection (VAD) / Trim silence
        y_trimmed = self._apply_vad_trim(y)
        if len(y_trimmed) > self.target_sr * 0.2: # Keep trimmed if at least 200ms of voice
            y = y_trimmed

        return y, self.target_sr

    def _apply_vad_trim(self, y: np.ndarray, frame_length: int = 512, hop_length: int = 128, threshold_db: float = 35.0) -> np.ndarray:
        """
        Energy-based Voice Activity Detection and leading/trailing silence trimming.
        """
        if len(y) < frame_length:
            return y
        
        # Calculate short-time energy
        energy = np.array([
            np.sum(y[i:i+frame_length]**2)
            for i in range(0, len(y) - frame_length, hop_length)
        ])
        
        if len(energy) == 0 or np.max(energy) == 0:
            return y
            
        energy_db = 10 * np.log10(energy / (np.max(energy) + 1e-12) + 1e-12)
        active_frames = np.where(energy_db > -threshold_db)[0]
        
        if len(active_frames) == 0:
            return y
            
        start_idx = max(0, active_frames[0] * hop_length - hop_length * 2)
        end_idx = min(len(y), (active_frames[-1] + 1) * hop_length + frame_length + hop_length * 2)
        return y[start_idx:end_idx]

    def extract_features(self, y: np.ndarray, sr: int = 16000) -> dict:
        """
        Extract acoustic, spectral, pitch, and cepstral features.
        """
        duration = len(y) / sr
        
        # 1. Log Mel-Spectrogram (128 bands)
        if HAS_LIBROSA:
            mel_spec = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=2048, hop_length=512, n_mels=128)
            log_mel_spec = librosa.power_to_db(mel_spec, ref=np.max)
            
            # MFCC (20 coeffs) + Deltas
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20, n_fft=2048, hop_length=512)
            mfcc_delta = librosa.feature.delta(mfcc)
            mfcc_delta2 = librosa.feature.delta(mfcc, order=2)
            
            # Spectral Centroid & Rolloff
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=2048, hop_length=512)[0]
            spectral_rolloff_85 = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85, n_fft=2048, hop_length=512)[0]
            spectral_flatness = librosa.feature.spectral_flatness(y=y, n_fft=2048, hop_length=512)[0]
            spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_fft=2048, hop_length=512)
            
            # Pitch Tracking (YIN / pyin)
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=sr,
                hop_length=512
            )
            f0_clean = f0[~np.isnan(f0)] if f0 is not None else np.array([])
        else:
            # Fallback pure scipy computation
            f, t, spec = scipy.signal.spectrogram(y, fs=sr, nperseg=512, noverlap=256)
            log_mel_spec = 10 * np.log10(np.abs(spec) + 1e-9)
            mfcc = np.zeros((20, log_mel_spec.shape[1]))
            mfcc_delta = np.zeros_like(mfcc)
            mfcc_delta2 = np.zeros_like(mfcc)
            spectral_centroid = np.mean(f[:, None] * spec, axis=0) / (np.sum(spec, axis=0) + 1e-9)
            spectral_rolloff_85 = np.ones(log_mel_spec.shape[1]) * 3500.0
            spectral_flatness = np.zeros(log_mel_spec.shape[1])
            spectral_contrast = np.zeros((7, log_mel_spec.shape[1]))
            f0_clean = np.array([160.0])
            voiced_flag = np.ones(log_mel_spec.shape[1], dtype=bool)

        # 2. Compute Glottal / Vocal Cord Biometrics (Jitter, Shimmer, Pitch Stats)
        pitch_mean = float(np.mean(f0_clean)) if len(f0_clean) > 0 else 0.0
        pitch_std = float(np.std(f0_clean)) if len(f0_clean) > 0 else 0.0
        pitch_min = float(np.min(f0_clean)) if len(f0_clean) > 0 else 0.0
        pitch_max = float(np.max(f0_clean)) if len(f0_clean) > 0 else 0.0
        
        # Jitter: Relative cycle-to-cycle pitch perturbation
        if len(f0_clean) > 3:
            diffs = np.abs(np.diff(f0_clean))
            jitter_relative = float(np.mean(diffs) / (pitch_mean + 1e-6) * 100.0)
        else:
            jitter_relative = 0.5

        # Shimmer: Relative cycle-to-cycle amplitude perturbation
        valid_len = (len(y) // 256) * 256
        if valid_len >= 256:
            frames = y[:valid_len].reshape(-1, 256)
            frame_energies = np.sqrt(np.mean(np.square(frames), axis=1))
        else:
            frame_energies = np.array([0.1])
        if len(frame_energies) > 3:
            amp_diffs = np.abs(np.diff(frame_energies))
            shimmer_relative = float(np.mean(amp_diffs) / (np.mean(frame_energies) + 1e-6) * 100.0)
        else:
            shimmer_relative = 2.0

        # 3. High Frequency Energy Ratio (>4kHz vs total energy)
        # Deepfake vocoders (HiFi-GAN, WaveGlow) often demonstrate spectral cutoff or high-freq phase anomalies above 4kHz
        fft_vals = np.abs(np.fft.rfft(y))
        freqs = np.fft.rfftfreq(len(y), 1.0 / sr)
        high_freq_mask = freqs >= 4000
        high_freq_energy = float(np.sum(fft_vals[high_freq_mask] ** 2))
        total_energy = float(np.sum(fft_vals ** 2) + 1e-9)
        high_freq_ratio = float(high_freq_energy / total_energy)

        # 4. Generate Downsampled Representations for UI Visualizers
        # Downsampled waveform (e.g. 150 points for rich UI wave display)
        step = max(1, len(y) // 150)
        waveform_preview = [round(float(np.max(np.abs(y[i:i+step]))), 3) for i in range(0, len(y), step)][:150]
        
        # Downsampled spectrogram thumbnail (20 time bins x 16 freq bins)
        if log_mel_spec.shape[1] > 20:
            mel_reduced = scipy.ndimage.zoom(log_mel_spec, (16 / log_mel_spec.shape[0], 20 / log_mel_spec.shape[1]))
        else:
            mel_reduced = log_mel_spec[:16, :20]
        
        # Normalize mel thumbnail 0.0 - 1.0 for UI display
        mel_min, mel_max = np.min(mel_reduced), np.max(mel_reduced)
        mel_normalized = ((mel_reduced - mel_min) / (mel_max - mel_min + 1e-9)).tolist() if mel_max > mel_min else mel_reduced.tolist()

        return {
            "duration": round(duration, 3),
            "sample_rate": sr,
            "num_samples": len(y),
            "waveform_preview": waveform_preview,
            "spectrogram_preview": mel_normalized,
            "raw_log_mel": log_mel_spec,
            "raw_mfcc": mfcc,
            "raw_mfcc_delta": mfcc_delta,
            "raw_mfcc_delta2": mfcc_delta2,
            "f0_track": [round(float(x), 1) if not np.isnan(x) else None for x in f0[:100]] if 'f0' in locals() and f0 is not None else [],
            "telemetry": {
                "pitch_mean_hz": round(pitch_mean, 1),
                "pitch_std_hz": round(pitch_std, 1),
                "pitch_range": f"{round(pitch_min, 1)} - {round(pitch_max, 1)} Hz",
                "jitter_percent": round(jitter_relative, 3),
                "shimmer_percent": round(shimmer_relative, 3),
                "spectral_centroid_hz": round(float(np.mean(spectral_centroid)), 1),
                "spectral_rolloff_85_hz": round(float(np.mean(spectral_rolloff_85)), 1),
                "spectral_flatness": round(float(np.mean(spectral_flatness)), 4),
                "high_freq_ratio": round(high_freq_ratio, 4),
            }
        }
