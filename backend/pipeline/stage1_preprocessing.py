import io
import os
import math
import numpy as np
import scipy.signal
import scipy.io.wavfile
import scipy.fftpack
import scipy.ndimage

try:
    import librosa
    import soundfile as sf
    HAS_LIBROSA = True
except Exception:
    HAS_LIBROSA = False


class AudioPreprocessor:
    """
    Stage 1: Ingestion, Resampling, VAD/Silence Trimming, and Multi-Vector Acoustic Feature Extraction.
    Standardizes audio to 16kHz mono and computes spectral, cepstral (MFCC + LFCC), glottal/pitch,
    harmonics-to-noise (HNR), and vocoder anti-spoofing biometrics.
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
        if len(y_trimmed) > self.target_sr * 0.2:
            y = y_trimmed

        return y, self.target_sr

    def _apply_vad_trim(self, y: np.ndarray, frame_length: int = 512, hop_length: int = 128, threshold_db: float = 38.0) -> np.ndarray:
        """
        Energy-based Voice Activity Detection and leading/trailing silence trimming.
        """
        if len(y) < frame_length:
            return y
        
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

    def _compute_lfcc(self, y: np.ndarray, sr: int = 16000, n_lfcc: int = 20, n_fft: int = 1024, hop_length: int = 256) -> np.ndarray:
        """
        Linear Frequency Cepstral Coefficients (LFCC) - standard acoustic benchmark for vocoder & deepfake detection.
        Unlike Mel filters, linear filterbanks preserve high-frequency harmonic spacing that reveals vocoder artifacts.
        """
        if len(y) < n_fft:
            return np.zeros((n_lfcc, 1), dtype=np.float32)

        window = np.hanning(n_fft)
        num_frames = (len(y) - n_fft) // hop_length + 1
        if num_frames <= 0:
            return np.zeros((n_lfcc, 1), dtype=np.float32)

        frames = np.lib.stride_tricks.sliding_window_view(y[:(num_frames - 1) * hop_length + n_fft], n_fft)[::hop_length]
        stft = np.abs(np.fft.rfft(frames * window, axis=1)).T # (n_fft // 2 + 1, num_frames)
        
        # Linear filterbank (40 linearly spaced triangular filters from 0 to sr/2)
        num_filters = 40
        num_bins = n_fft // 2 + 1
        filter_points = np.linspace(0, num_bins - 1, num_filters + 2, dtype=int)
        filters = np.zeros((num_filters, num_bins))
        for i in range(num_filters):
            f_m_minus = filter_points[i]
            f_m = filter_points[i + 1]
            f_m_plus = filter_points[i + 2]
            
            if f_m > f_m_minus:
                filters[i, f_m_minus:f_m] = np.linspace(0, 1, f_m - f_m_minus, endpoint=False)
            if f_m_plus > f_m:
                filters[i, f_m:f_m_plus] = np.linspace(1, 0, f_m_plus - f_m, endpoint=False)
                
        # Filterbank energies
        fb_energies = np.dot(filters, stft**2)
        log_fb = np.log(fb_energies + 1e-10)
        
        # Discrete Cosine Transform (DCT-II)
        lfcc = scipy.fftpack.dct(log_fb, type=2, axis=0, norm='ortho')[:n_lfcc, :]
        return lfcc

    def _compute_pitch_cycle_perturbations(self, y: np.ndarray, sr: int = 16000) -> tuple[float, float, float, float, float, np.ndarray]:
        """
        Pitch-synchronous glottal cycle-to-cycle Jitter, Shimmer, and Harmonics-to-Noise Ratio (HNR).
        Isolates vocal fold glottal pulses via pitch peak detection and local envelope normalization.
        """
        if len(y) < sr * 0.1:
            return 160.0, 15.0, 0.6, 2.5, 12.0, np.array([160.0])

        # 1. Pitch tracking via autocorrelation
        f0_track = []
        hnr_values = []
        frame_len = int(sr * 0.04)
        hop_len = int(sr * 0.01)
        min_lag = int(sr / 450)
        max_lag = int(sr / 65)
        
        for i in range(0, len(y) - frame_len, hop_len):
            frame = y[i:i+frame_len]
            frame_rms = np.sqrt(np.mean(frame**2))
            if frame_rms < 0.02:
                continue
                
            corr = np.correlate(frame, frame, mode='full')[frame_len - 1:]
            if len(corr) <= max_lag:
                continue
                
            search_window = corr[min_lag:max_lag]
            if len(search_window) == 0:
                continue
                
            peak_offset = np.argmax(search_window)
            best_lag = min_lag + peak_offset
            peak_val = corr[best_lag]
            zero_lag_val = corr[0] + 1e-12
            norm_peak = peak_val / zero_lag_val
            
            if norm_peak > 0.40:
                f0 = sr / best_lag
                f0_track.append(f0)
                noise_energy = max(1e-12, zero_lag_val - peak_val)
                hnr = 10 * np.log10(max(1e-12, peak_val) / noise_energy)
                hnr_values.append(hnr)

        f0_arr = np.array(f0_track) if len(f0_track) > 0 else np.array([160.0])
        pitch_mean = float(np.mean(f0_arr))
        pitch_std = float(np.std(f0_arr))
        mean_hnr = float(np.mean(hnr_values)) if len(hnr_values) > 0 else 12.0

        # 2. Glottal cycle peak detection for true period Jitter & Shimmer
        try:
            b, a = scipy.signal.butter(4, min(0.45, 600.0 / (sr / 2)), btype='low')
            y_filt = scipy.signal.filtfilt(b, a, y)
            peaks, _ = scipy.signal.find_peaks(y_filt, distance=max(10, int(sr / 450)), prominence=0.04)
            
            if len(peaks) > 6:
                periods = np.diff(peaks) / float(sr)
                # Jitter: Relative mean period difference
                period_diffs = np.abs(np.diff(periods))
                jitter_pct = float(np.mean(period_diffs) / (np.mean(periods) + 1e-9) * 100.0)
                
                # Shimmer: Relative cycle amplitude perturbation normalized against local median envelope
                peak_amps = np.abs(y[peaks])
                med_env = scipy.ndimage.median_filter(peak_amps, size=min(7, len(peak_amps)))
                res_amps = np.abs(peak_amps - med_env) / (med_env + 1e-6)
                shimmer_pct = float(np.mean(res_amps) * 100.0)
            else:
                jitter_pct = 0.65
                shimmer_pct = 2.2
        except Exception:
            jitter_pct = 0.65
            shimmer_pct = 2.2

        return round(pitch_mean, 1), round(pitch_std, 1), round(jitter_pct, 3), round(shimmer_pct, 3), round(mean_hnr, 1), f0_arr

    def _compute_cepstral_peak_prominence(self, y: np.ndarray, sr: int = 16000) -> float:
        """
        Compute normalized Cepstral Peak Prominence (CPP) (dB).
        """
        if len(y) < 1024:
            return 12.0
            
        w = np.hanning(len(y))
        spectrum = np.abs(np.fft.rfft(y * w))
        log_spec = np.log(spectrum + 1e-9)
        cepstrum = np.abs(np.fft.irfft(log_spec))
        
        min_que = int(sr / 450)
        max_que = int(sr / 65)
        if len(cepstrum) <= max_que:
            return 12.0
            
        que_window = cepstrum[min_que:max_que]
        if len(que_window) == 0:
            return 12.0
            
        peak_val = np.max(que_window)
        mean_val = np.mean(que_window) + 1e-12
        cpp_db = 10 * np.log10(peak_val / mean_val + 1e-6)
        return round(float(max(0.0, min(30.0, cpp_db))), 2)

    def extract_features(self, y: np.ndarray, sr: int = 16000) -> dict:
        """
        Extract multi-vector acoustic, spectral, pitch, LFCC, MFCC, and forensic anti-spoofing features.
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
        else:
            f, t, spec = scipy.signal.spectrogram(y, fs=sr, nperseg=512, noverlap=256)
            log_mel_spec = 10 * np.log10(np.abs(spec) + 1e-9)
            mfcc = np.zeros((20, log_mel_spec.shape[1]))
            mfcc_delta = np.zeros_like(mfcc)
            mfcc_delta2 = np.zeros_like(mfcc)
            spectral_centroid = np.mean(f[:, None] * spec, axis=0) / (np.sum(spec, axis=0) + 1e-9)
            spectral_rolloff_85 = np.ones(log_mel_spec.shape[1]) * 3500.0
            spectral_flatness = np.zeros(log_mel_spec.shape[1])
            spectral_contrast = np.zeros((7, log_mel_spec.shape[1]))

        # 2. Linear Frequency Cepstral Coefficients (LFCC)
        lfcc = self._compute_lfcc(y, sr=sr, n_lfcc=20, n_fft=1024, hop_length=256)
        lfcc_delta = np.gradient(lfcc, axis=1) if lfcc.shape[1] > 1 else np.zeros_like(lfcc)

        # 3. Precise Glottal & Pitch Biometrics (Pitch-synchronous Jitter, Shimmer, HNR)
        pitch_mean, pitch_std, jitter_pct, shimmer_pct, mean_hnr, f0_clean = self._compute_pitch_cycle_perturbations(y, sr)
        pitch_min = float(np.min(f0_clean)) if len(f0_clean) > 0 else 0.0
        pitch_max = float(np.max(f0_clean)) if len(f0_clean) > 0 else 0.0

        # 4. Cepstral Peak Prominence (CPP)
        cpp_score = self._compute_cepstral_peak_prominence(y, sr)

        # 5. Multi-Band Energy & High Frequency Spectral Crest Forensics
        fft_vals = np.abs(np.fft.rfft(y))
        freqs = np.fft.rfftfreq(len(y), 1.0 / sr)
        
        # Sub-band masks: Low (0-2kHz), Mid (2-4kHz), High (4-8kHz)
        low_mask = (freqs >= 100) & (freqs < 2000)
        mid_mask = (freqs >= 2000) & (freqs < 4000)
        high_mask = freqs >= 4000
        
        total_energy = float(np.sum(fft_vals ** 2) + 1e-9)
        low_energy = float(np.sum(fft_vals[low_mask] ** 2))
        mid_energy = float(np.sum(fft_vals[mid_mask] ** 2))
        high_energy = float(np.sum(fft_vals[high_mask] ** 2))
        
        high_freq_ratio = float(high_energy / total_energy)
        mid_to_low_ratio = float(mid_energy / (low_energy + 1e-9))
        
        # Spectral Crest Factor (Peak to RMS ratio in 2.5-7.5kHz high band)
        high_band_vals = fft_vals[freqs >= 2500]
        if len(high_band_vals) > 0:
            crest_factor = float(np.max(high_band_vals) / (np.sqrt(np.mean(high_band_vals ** 2)) + 1e-9))
        else:
            crest_factor = 4.0

        # 6. Spectral Flux
        if log_mel_spec.shape[1] > 2:
            spec_flux = float(np.mean(np.diff(log_mel_spec, axis=1) ** 2))
        else:
            spec_flux = 1.0

        # 7. Generate Downsampled Representations for UI Visualizers
        step = max(1, len(y) // 150)
        waveform_preview = [round(float(np.max(np.abs(y[i:i+step]))), 3) for i in range(0, len(y), step)][:150]
        
        if log_mel_spec.shape[1] > 20:
            mel_reduced = scipy.ndimage.zoom(log_mel_spec, (16 / log_mel_spec.shape[0], 20 / log_mel_spec.shape[1]))
        else:
            mel_reduced = log_mel_spec[:16, :20]
        
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
            "raw_lfcc": lfcc,
            "raw_lfcc_delta": lfcc_delta,
            "f0_track": [round(float(x), 1) for x in f0_clean[:100]],
            "telemetry": {
                "pitch_mean_hz": round(pitch_mean, 1),
                "pitch_std_hz": round(pitch_std, 1),
                "pitch_range": f"{round(pitch_min, 1)} - {round(pitch_max, 1)} Hz",
                "jitter_percent": round(jitter_pct, 3),
                "shimmer_percent": round(shimmer_pct, 3),
                "hnr_db": round(mean_hnr, 1),
                "cpp_score": cpp_score,
                "spectral_centroid_hz": round(float(np.mean(spectral_centroid)), 1),
                "spectral_rolloff_85_hz": round(float(np.mean(spectral_rolloff_85)), 1),
                "spectral_flatness": round(float(np.mean(spectral_flatness)), 4),
                "high_freq_ratio": round(high_freq_ratio, 4),
                "mid_to_low_ratio": round(mid_to_low_ratio, 4),
                "crest_factor": round(crest_factor, 2),
                "spectral_flux": round(spec_flux, 2),
            }
        }
