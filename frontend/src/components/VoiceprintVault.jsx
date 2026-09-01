import React, { useState, useRef } from 'react';
import { Mic, Square, Trash2, Check, UserPlus, X } from 'lucide-react';

export default function VoiceprintVault({ speakers = [], onRefresh, onNotification }) {
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Executive Leadership');
  const [department, setDepartment] = useState('Executive Operations');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone error: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!name || !audioBlob) {
      alert('Please provide speaker name and a voice sample.');
      return;
    }

    setIsEnrolling(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('role', role);
      formData.append('department', department);
      formData.append('audio_file', audioBlob, 'enrollment.wav');

      const res = await fetch('/api/enroll', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Enrollment failed');

      if (onNotification) {
        onNotification({
          decision: 'ALLOW_ACCESS',
          threat_level: 'LOW',
          message: `Voiceprint for ${name} enrolled successfully.`,
          risk_pct: 0,
        });
      }

      if (onRefresh) onRefresh();
      
      setIsEnrollModalOpen(false);
      setName('');
      setEmail('');
      setAudioBlob(null);
    } catch (err) {
      alert('Error during enrollment: ' + err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRevoke = async (id, speakerName) => {
    if (!window.confirm(`Revoke voiceprint for ${speakerName}?`)) return;
    try {
      const res = await fetch(`/api/speakers/${id}`, { method: 'DELETE' });
      if (res.ok && onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-12 py-4">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-black/[0.06]">
        <div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F]">
            Voiceprints
          </h1>
          <p className="text-base sm:text-lg text-[#86868B] mt-2 font-normal max-w-2xl leading-relaxed">
            Registered biometric identities. 256-dimensional acoustic embeddings are sealed and matched against incoming voice calls.
          </p>
        </div>

        <button
          onClick={() => setIsEnrollModalOpen(true)}
          className="apple-btn-primary"
        >
          <UserPlus className="w-4 h-4" />
          <span>Enroll voiceprint</span>
        </button>
      </div>

      {/* Voiceprints List */}
      <div className="apple-card divide-y divide-black/[0.06] overflow-hidden">
        {speakers.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#86868B]">
            No voiceprints registered yet. Click "Enroll voiceprint" to register an identity.
          </div>
        ) : (
          speakers.map((s) => (
            <div
              key={s.id}
              className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAFAFC] transition"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-[#E8E8ED] text-[#1D1D1F] flex items-center justify-center font-semibold text-sm">
                  {s.name[0]}
                </div>
                <div>
                  <div className="text-base font-semibold text-[#1D1D1F]">
                    {s.name}
                  </div>
                  <div className="text-xs text-[#86868B] mt-0.5">
                    {s.role} • {s.department}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-6 text-xs text-[#86868B]">
                <div className="hidden md:block">
                  <span className="font-mono text-[#1D1D1F] bg-[#F5F5F7] px-2.5 py-1 rounded-md text-[11px]">
                    {s.voiceprint_id}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 text-[#34C759] font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>Enrolled</span>
                </div>

                <button
                  onClick={() => handleRevoke(s.id, s.name)}
                  className="p-1.5 rounded-full hover:bg-black/[0.05] text-[#86868B] hover:text-[#FF3B30] transition"
                  title="Revoke voiceprint"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Apple Sheet Modal for Enrollment */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-apple-modal border border-black/[0.06] space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#1D1D1F]">
                Enroll Voiceprint
              </h2>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#E8E8ED] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#86868B] mb-1 font-medium">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alice Walker"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#F5F5F7] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
                <div>
                  <label className="block text-[#86868B] mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    placeholder="alice@corp.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#F5F5F7] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#86868B] mb-1 font-medium">Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#F5F5F7] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
                <div>
                  <label className="block text-[#86868B] mb-1 font-medium">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-[#F5F5F7] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
              </div>

              {/* Calibration sentence */}
              <div className="p-4 rounded-2xl bg-[#F5F5F7] space-y-1">
                <span className="text-[11px] text-[#86868B] font-medium block">
                  Please read the phrase aloud:
                </span>
                <p className="text-xs text-[#1D1D1F] font-normal leading-relaxed">
                  "I authorize Deadlock Voice Security to register my biometric acoustic voiceprint for identity verification."
                </p>
              </div>

              {/* Audio Recorder Controls */}
              <div className="p-4 rounded-2xl bg-[#F5F5F7] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="apple-btn-primary"
                    >
                      <Mic className="w-4 h-4" />
                      <span>{audioBlob ? 'Re-record' : 'Record voice'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium bg-[#FF3B30] text-white hover:opacity-90 transition active:scale-95"
                    >
                      <Square className="w-4 h-4" />
                      <span>Stop ({recordDuration}s)</span>
                    </button>
                  )}

                  {audioBlob && !isRecording && (
                    <span className="text-[#34C759] text-xs font-medium flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Recorded ({recordDuration}s)</span>
                    </span>
                  )}
                </div>

                <label className="text-xs text-[#0071E3] hover:underline cursor-pointer">
                  <span>Upload file</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        setAudioBlob(e.target.files[0]);
                        setRecordDuration(3);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="apple-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEnrolling || !audioBlob || !name}
                  className="apple-btn-primary disabled:opacity-50"
                >
                  {isEnrolling ? 'Saving...' : 'Save Voiceprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
