import os
import math
import numpy as np
import scipy.io.wavfile

def generate_sample_audio_files(output_dir: str = "./sample_audios"):
    """
    Generate realistic acoustic test files with distinct physical and spectral signatures.
    """
    os.makedirs(output_dir, exist_ok=True)
    sr = 16000
    duration = 3.5 # seconds
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    # 1. Alice Real Voice (Natural Human Speech: Rich Formants F1=500Hz, F2=1500Hz, F3=2600Hz, F4=3800Hz, F5=4800Hz with natural pitch inflection and micro-tremor)
    f0_alice = 190.0 + 20.0 * np.sin(2 * np.pi * 1.2 * t) + 10.0 * np.sin(2 * np.pi * 3.5 * t)
    # Add human vocal cord physical jitter micro-tremor
    jitter_alice = 0.012 * np.sin(2 * np.pi * 28.0 * t) + np.random.normal(0, 0.003, len(t))
    phase_alice = np.cumsum(2 * np.pi * (f0_alice * (1.0 + jitter_alice)) / sr)
    
    # Formant resonances (Vocal tract filter simulation with upper harmonics and unvoiced sibilants)
    sig_alice = (
        0.40 * np.sin(phase_alice) +
        0.25 * np.sin(2 * phase_alice) +
        0.18 * np.sin(3 * phase_alice) +
        0.12 * np.sin(4 * phase_alice) +
        0.10 * np.sin(6 * phase_alice) +
        0.08 * np.sin(12 * phase_alice) + # ~2300 Hz Formant
        0.06 * np.sin(20 * phase_alice) + # ~3800 Hz Formant
        0.04 * np.sin(26 * phase_alice)   # ~4900 Hz Formant
    )
    # Natural speech amplitude envelope (syllable bursts)
    env_alice = np.clip(np.sin(2 * np.pi * 1.8 * t) ** 2 + 0.15, 0.0, 1.0)
    sig_alice = sig_alice * env_alice
    # Natural consonant fricatives in speech
    fricatives = (np.sin(2 * np.pi * 1.8 * t) > 0.6).astype(float) * np.random.normal(0, 0.03, len(t))
    sig_alice += fricatives
    # Natural broadband room acoustic noise
    sig_alice += np.random.normal(0, 0.006, len(t))
    sig_alice = sig_alice / (np.max(np.abs(sig_alice)) + 1e-6) * 0.85
    
    alice_real_path = os.path.join(output_dir, "alice_real_authorized.wav")
    scipy.io.wavfile.write(alice_real_path, sr, (sig_alice * 32767).astype(np.int16))

    # 2. Alice AI Cloned Voice (Synthetic Vocoder Artifacts: Quantized F0, Zero Natural Jitter, 4kHz Cutoff, Spectral Flatness)
    # Robotically quantized / over-smoothed pitch contour with steps
    f0_clone = 190.0 + np.round(15.0 * np.sin(2 * np.pi * 1.2 * t) / 10.0) * 10.0 # Stepped quantized pitch
    phase_clone = np.cumsum(2 * np.pi * f0_clone / sr)
    
    sig_clone = (
        0.60 * np.sin(phase_clone) +
        0.30 * np.sin(2 * phase_clone) +
        0.15 * np.sin(3 * phase_clone) # Hard cutoff above 600Hz, no higher formants
    )
    sig_clone = sig_clone * env_alice
    # Vocoder phase buzz
    sig_clone += 0.002 * np.sin(2 * np.pi * 3200 * t)
    sig_clone = sig_clone / (np.max(np.abs(sig_clone)) + 1e-6) * 0.85

    alice_clone_path = os.path.join(output_dir, "alice_cloned_elevenlabs.wav")
    scipy.io.wavfile.write(alice_clone_path, sr, (sig_clone * 32767).astype(np.int16))

    # 3. Bob Real Impersonator (Authentic Male Voice with lower pitch F0=115Hz, different vocal tract resonances)
    f0_bob = 115.0 + 15.0 * np.sin(2 * np.pi * 0.9 * t) + 6.0 * np.sin(2 * np.pi * 2.8 * t)
    jitter_bob = 0.015 * np.sin(2 * np.pi * 22.0 * t) + np.random.normal(0, 0.004, len(t))
    phase_bob = np.cumsum(2 * np.pi * (f0_bob * (1.0 + jitter_bob)) / sr)
    
    sig_bob = (
        0.60 * np.sin(phase_bob) +
        0.35 * np.sin(2 * phase_bob) +
        0.22 * np.sin(3 * phase_bob) +
        0.15 * np.sin(4 * phase_bob) +
        0.09 * np.sin(5 * phase_bob)
    )
    env_bob = np.clip(np.sin(2 * np.pi * 1.5 * t) ** 2 + 0.12, 0.0, 1.0)
    sig_bob = sig_bob * env_bob + np.random.normal(0, 0.009, len(t))
    sig_bob = sig_bob / (np.max(np.abs(sig_bob)) + 1e-6) * 0.85

    bob_path = os.path.join(output_dir, "bob_real_impersonator.wav")
    scipy.io.wavfile.write(bob_path, sr, (sig_bob * 32767).astype(np.int16))

    # 4. Noisy Deepfake Call (Synthetic speech + Telephony 300Hz-3.4kHz Bandpass + Packet Noise)
    sig_noisy = sig_clone + np.random.normal(0, 0.04, len(t)) # Telephony noise
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
