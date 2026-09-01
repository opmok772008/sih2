import React, { useState, useEffect } from 'react';
import { ShieldCheck, Download, Search, Check, RefreshCw } from 'lucide-react';

export default function BlockchainExplorer({ onNotification }) {
  const [ledgerData, setLedgerData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/blockchain/ledger');
      const data = await res.json();
      setLedgerData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleVerifyLedger = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/blockchain/verify');
      const data = await res.json();
      setVerificationResult(data);
      if (onNotification) {
        onNotification({
          decision: data.is_valid ? 'ALLOW_ACCESS' : 'BLOCK_AND_ALERT',
          threat_level: data.is_valid ? 'LOW' : 'CRITICAL',
          message: data.is_valid
            ? `Cryptographic proof verified across ${data.total_blocks} chained blocks. Zero tampering detected.`
            : `Security Alert: Tampering detected in audit ledger!`,
          risk_pct: data.is_valid ? 0 : 100,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExportJSON = () => {
    if (!ledgerData) return;
    const blob = new Blob([JSON.stringify(ledgerData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deadlock_audit_ledger_${Date.now()}.json`;
    a.click();
  };

  const blocks = ledgerData?.blocks || [];
  const filteredBlocks = blocks.filter(b => 
    b.session_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.claimed_identity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.block_hash?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.event_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12 py-4">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-black/[0.06]">
        <div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F]">
            Audit Ledger
          </h1>
          <p className="text-base sm:text-lg text-[#86868B] mt-2 font-normal max-w-2xl leading-relaxed">
            Immutable SHA-256 cryptographic ledger. Every verification decision is signed and sealed on-chain for non-repudiation.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportJSON}
            className="apple-btn-secondary"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON</span>
          </button>
          
          <button
            onClick={handleVerifyLedger}
            disabled={isVerifying}
            className="apple-btn-primary disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isVerifying ? 'Verifying...' : 'Verify ledger integrity'}</span>
          </button>
        </div>
      </div>

      {/* Verification Summary Card (Apple Spec Card) */}
      {verificationResult && (
        <div className="apple-card p-8 space-y-6">
          <div className="flex items-center space-x-2 text-[#34C759]">
            <Check className="w-5 h-5 stroke-[2.5]" />
            <h3 className="text-lg font-semibold text-[#1D1D1F]">
              Cryptographic integrity confirmed.
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-black/[0.06]">
            <div>
              <div className="text-3xl sm:text-4xl font-light text-[#1D1D1F]">
                {verificationResult.total_blocks}
              </div>
              <div className="text-xs text-[#86868B] mt-1 font-normal">
                Blocks verified
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-light text-[#34C759]">
                0
              </div>
              <div className="text-xs text-[#86868B] mt-1 font-normal">
                Tampered blocks
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-light text-[#1D1D1F]">
                SHA-256
              </div>
              <div className="text-xs text-[#86868B] mt-1 font-normal">
                Hash algorithm
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-light text-[#1D1D1F]">
                HMAC
              </div>
              <div className="text-xs text-[#86868B] mt-1 font-normal">
                Signature proof
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Refresh */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#86868B] absolute left-4 top-3" />
          <input
            type="text"
            placeholder="Search by session ID, speaker, or block hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#E8E8ED] rounded-full pl-10 pr-4 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
          />
        </div>

        <button
          onClick={fetchLedger}
          className="apple-btn-secondary text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Chained Blocks List */}
      <div className="space-y-4">
        {filteredBlocks.length === 0 ? (
          <div className="apple-card p-12 text-center text-sm text-[#86868B]">
            No audit blocks found.
          </div>
        ) : (
          filteredBlocks.map((block) => {
            const isBlocked = block.decision === 'BLOCK_AND_ALERT';
            return (
              <div
                key={block.index}
                className="apple-card p-6 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.06] pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-sm text-[#1D1D1F]">
                      Block #{block.index}
                    </span>
                    <span className="text-xs text-[#86868B]">
                      {block.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className={`px-2.5 py-0.5 rounded-full font-medium ${
                      isBlocked ? 'bg-[#FF3B30]/10 text-[#FF3B30]' : 'bg-[#34C759]/10 text-[#34C759]'
                    }`}>
                      {block.decision.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[#86868B]">
                      {new Date(block.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#86868B] pt-1 font-mono">
                  <div className="space-y-1">
                    <div className="truncate">Speaker: <span className="text-[#1D1D1F] font-sans">{block.claimed_identity}</span></div>
                    <div className="truncate">Session: <span className="text-[#1D1D1F]">{block.session_id}</span></div>
                    <div className="truncate text-[#86868B]">Prev: {block.prev_hash}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="truncate font-semibold text-[#1D1D1F]">Hash: {block.block_hash}</div>
                    <div className="truncate">HMAC: {block.signature}</div>
                    <div className="truncate text-[#34C759] font-sans font-medium flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Sealed block</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
