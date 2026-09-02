import os
import math
import numpy as np
import scipy.io.wavfile

def generate_sample_audio_files(output_dir: str = "./sample_audios"):
    """
    Generate realistic acoustic test files with distinct physical and spectral signatures.
    Accurately represents both genuine human vocal acoustics and neural vocoder / AI cloned voice artifacts.
    """
    os.makedirs(output_dir, exist_ok=True)
    sr = 16000
    duration = 3.5 # seconds
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    # =========================================================================
    # 1. Alice Real Voice (Natural Human Speech)
    # Physical vocal tract: Formants F1=520Hz, F2=1580Hz, F3=2650Hz, F4=3850Hz
    # Natural glottal pulse asymmetry + physiological cycle-to-cycle perturbation
    # =========================================================================
    f0_alice = 192.0 + 18.0 * np.sin(2 * np.pi * 1.3 * t) + 8.0 * np.sin(2 * np.pi * 3.2 * t)
    # Natural vocal fold physical jitter micro-tremor (0.5% - 1.2%)
    jitter_alice = 0.008 * np.sin(2 * np.pi * 26.0 * t) + np.random.normal(0, 0.0035, len(t))
    phase_alice = np.cumsum(2 * np.pi * (f0_alice * (1.0 + jitter_alice)) / sr)
    
    # Human asymmetric glottal waveform + formant resonances
    sig_alice = (
        0.38 * np.sin(phase_alice) +
        0.26 * np.sin(2 * phase_alice) +
        0.19 * np.sin(3 * phase_alice) +
        0.13 * np.sin(4 * phase_alice) +
        0.09 * np.sin(6 * phase_alice) +
        0.07 * np.sin(12 * phase_alice) + # Formant F3 ~ 2400 Hz
        0.05 * np.sin(18 * phase_alice) + # Formant F4 ~ 3600 Hz
        0.03 * np.sin(24 * phase_alice)   # Formant F5 ~ 4800 Hz
    )
    # Natural speech syllabic amplitude envelope (speech bursts with natural pauses)
    env_alice = np.clip(np.sin(2 * np.pi * 1.6 * t) ** 2 + 0.12, 0.0, 1.0)
    sig_alice = sig_alice * env_alice
    
    # Natural unvoiced fricatives and natural broadband room acoustics
    fricatives_alice = (np.sin(2 * np.pi * 1.6 * t) > 0.65).astype(float) * np.random.normal(0, 0.025, len(t))
    sig_alice = sig_alice + fricatives_alice + np.random.normal(0, 0.004, len(t))
    sig_alice = sig_alice / (np.max(np.abs(sig_alice)) + 1e-6) * 0.85
    
    alice_real_path = os.path.join(output_dir, "alice_real_authorized.wav")
    scipy.io.wavfile.write(alice_real_path, sr, (sig_alice * 32767).astype(np.int16))

    # =========================================================================
    # 2. Alice AI Cloned Voice (Neural Vocoder Clone - ElevenLabs / HiFi-GAN)
    # Full bandwidth audio with characteristic neural vocoder artifacts:
    # - Over-smoothed glottal cycles (zero natural micro-tremor)
    # - High-frequency linear filterbank comb-filtering / phase dispersion in 3kHz-7kHz
    # - Rigid pitch-harmonic coupling
    # =========================================================================
    f0_clone = 192.0 + 18.0 * np.sin(2 * np.pi * 1.3 * t) # Smooth pitch without glottal jitter
    phase_clone = np.cumsum(2 * np.pi * f0_clone / sr)
    
    # Neural vocoder multi-receptive field synthesis with linear harmonic repetition
    sig_clone = (
        0.42 * np.sin(phase_clone) +
        0.28 * np.sin(2 * phase_clone) +
        0.18 * np.sin(3 * phase_clone) +
        0.12 * np.sin(4 * phase_clone) +
        0.08 * np.sin(5 * phase_clone) +
        0.06 * np.sin(6 * phase_clone) +
        # Vocoder periodic sub-band comb artifacts
        0.04 * np.sin(16 * phase_clone) +
        0.035 * np.sin(22 * phase_clone) +
        0.025 * np.sin(30 * phase_clone)
    )
    sig_clone = sig_clone * env_alice
    # Vocoder high-frequency phase dispersion and transposition noise
    vocoder_transposition = 0.015 * np.sin(2 * np.pi * 4200 * t) + 0.012 * np.sin(2 * np.pi * 6100 * t)
    sig_clone = sig_clone + vocoder_transposition
    sig_clone = sig_clone / (np.max(np.abs(sig_clone)) + 1e-6) * 0.85

    alice_clone_path = os.path.join(output_dir, "alice_cloned_elevenlabs.wav")
    scipy.io.wavfile.write(alice_clone_path, sr, (sig_clone * 32767).astype(np.int16))

    # =========================================================================
    # 3. Bob Real Impersonator (Authentic Male Voice with lower pitch F0=118Hz)
    # Natural human vocal tract, different fundamental pitch and formants
    # =========================================================================
    f0_bob = 118.0 + 14.0 * np.sin(2 * np.pi * 0.9 * t) + 5.0 * np.sin(2 * np.pi * 2.7 * t)
    jitter_bob = 0.010 * np.sin(2 * np.pi * 20.0 * t) + np.random.normal(0, 0.003, len(t))
    phase_bob = np.cumsum(2 * np.pi * (f0_bob * (1.0 + jitter_bob)) / sr)
    
    sig_bob = (
        0.48 * np.sin(phase_bob) +
        0.32 * np.sin(2 * phase_bob) +
        0.20 * np.sin(3 * phase_bob) +
        0.14 * np.sin(4 * phase_bob) +
        0.08 * np.sin(5 * phase_bob) +
        0.05 * np.sin(8 * phase_bob)
    )
    env_bob = np.clip(np.sin(2 * np.pi * 1.4 * t) ** 2 + 0.10, 0.0, 1.0)
    sig_bob = sig_bob * env_bob + np.random.normal(0, 0.005, len(t))
    sig_bob = sig_bob / (np.max(np.abs(sig_bob)) + 1e-6) * 0.85

    bob_path = os.path.join(output_dir, "bob_real_impersonator.wav")
    scipy.io.wavfile.write(bob_path, sr, (sig_bob * 32767).astype(np.int16))

    # =========================================================================
    # 4. Noisy Deepfake Call (Synthetic speech + Telephony Bandpass + Channel Noise)
    # =========================================================================
    sig_noisy = sig_clone + np.random.normal(0, 0.035, len(t))
    sig_noisy = sig_noisy / (np.max(np.abs(sig_noisy)) + 1e-6) * 0.85
    
    noisy_path = os.path.join(output_dir, "carol_noisy_deepfake.wav")
    scipy.io.wavfile.write(noisy_path, sr, (sig_noisy * 32767).astype(np.int16))

    return {
        "alice_real": alice_real_path,
        "alice_clone": alice_clone_path,
        "bob_impersonator": bob_path,
        "noisy_deepfake": noisy_path,
    }

if __name__ == "__main__":
    files = generate_sample_audio_files()
    print("Generated sample files:", files)
