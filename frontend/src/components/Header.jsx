import React from 'react';
import { Shield } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, systemStatus }) {
  const tabs = [
    { id: 'live', name: 'Live Stream' },
    { id: 'lab', name: 'Forensics' },
    { id: 'vault', name: 'Voiceprints' },
    { id: 'blockchain', name: 'Audit Ledger' },
    { id: 'threats', name: 'Threat Policies' },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-black/[0.06] transition-all">
      <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => setActiveTab('live')}
          className="flex items-center space-x-2.5 cursor-pointer select-none group"
        >
          <div className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-[#1D1D1F] group-hover:opacity-80 transition">
            Deadlock
          </span>
        </div>

        {/* Navigation Tabs - Apple Text Nav */}
        <nav className="flex items-center space-x-7 text-[13px]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 transition-colors relative font-normal ${
                  isActive
                    ? 'text-[#1D1D1F] font-medium'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                <span>{tab.name}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1D1D1F] rounded-full"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* System Status - Minimal Apple Pill */}
        <div className="flex items-center space-x-2 text-xs text-[#86868B]">
          <span className="w-2 h-2 rounded-full bg-[#34C759]"></span>
          <span className="hidden sm:inline font-normal">Active</span>
        </div>
      </div>
    </header>
  );
}
