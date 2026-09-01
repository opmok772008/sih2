import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LiveCallInterceptor from './components/LiveCallInterceptor';
import ForensicAudioLab from './components/ForensicAudioLab';
import VoiceprintVault from './components/VoiceprintVault';
import BlockchainExplorer from './components/BlockchainExplorer';
import ThreatAnalytics from './components/ThreatAnalytics';
import AlertToast from './components/AlertToast';

export default function App() {
  const [activeTab, setActiveTab] = useState('live');
  const [systemStatus, setSystemStatus] = useState(null);
  const [speakers, setSpeakers] = useState([]);
  const [samples, setSamples] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);

  const fetchGlobalData = async () => {
    try {
      const [statusRes, speakersRes, samplesRes] = await Promise.all([
        fetch('/api/status').catch(() => null),
        fetch('/api/speakers').catch(() => null),
        fetch('/api/samples').catch(() => null),
      ]);

      if (statusRes && statusRes.ok) {
        const data = await statusRes.json();
        setSystemStatus(data);
      }
      if (speakersRes && speakersRes.ok) {
        const data = await speakersRes.json();
        setSpeakers(data);
      }
      if (samplesRes && samplesRes.ok) {
        const data = await samplesRes.json();
        setSamples(data);
      }
    } catch (err) {
      console.error('Failed to fetch system data:', err);
    }
  };

  useEffect(() => {
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerAlert = (alertData) => {
    setActiveAlert(alertData);
    fetchGlobalData();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans selection:bg-[#0071E3] selection:text-white">
      {/* Dynamic Toast Notification */}
      <AlertToast
        alert={activeAlert}
        onClose={() => setActiveAlert(null)}
        onViewLedger={() => {
          setActiveAlert(null);
          setActiveTab('blockchain');
        }}
      />

      {/* Apple Translucent Top Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />

      {/* Main Spacious Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {activeTab === 'live' && (
          <LiveCallInterceptor
            speakers={speakers}
            onThreatDetected={triggerAlert}
          />
        )}

        {activeTab === 'lab' && (
          <ForensicAudioLab
            speakers={speakers}
            samples={samples}
            onAnalysisComplete={() => fetchGlobalData()}
            onThreatDetected={triggerAlert}
          />
        )}

        {activeTab === 'vault' && (
          <VoiceprintVault
            speakers={speakers}
            onRefresh={fetchGlobalData}
            onNotification={triggerAlert}
          />
        )}

        {activeTab === 'blockchain' && (
          <BlockchainExplorer
            onNotification={triggerAlert}
          />
        )}

        {activeTab === 'threats' && (
          <ThreatAnalytics />
        )}
      </main>

      {/* Apple Editorial Footer */}
      <footer className="border-t border-black/[0.06] bg-[#F5F5F7] py-12 mt-16 text-xs text-[#86868B]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-semibold text-[#1D1D1F]">Deadlock</span>
            <span className="mx-2">•</span>
            <span>AI Voice Cloning Defense & Biometric Verification</span>
          </div>

          <div className="flex items-center space-x-6 text-[11px]">
            <span>Smart India Hackathon 2026</span>
            <span>Problem Statement 26104</span>
            <span>Blockchain & Cybersecurity</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
