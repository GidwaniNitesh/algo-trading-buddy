// src/components/TradingModeToggle.tsx
import React, { useState } from 'react';
import { useTradingStore } from '../store/zustandStore';
import { apiService } from '../services/apiService';
import { Shield, AlertTriangle } from 'lucide-react';

const TradingModeToggle: React.FC = () => {
  const { tradingMode, isPaper, broker } = useTradingStore((s) => ({
    tradingMode: s.tradingMode,
    isPaper: s.isPaper,
    broker: s.broker,
  }));
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleToggle = async () => {
    if (!isPaper) {
      // Currently real -> confirm before switching to paper
      setShowConfirm(true);
      return;
    }
    setShowConfirm(true);
  };

  const confirmSwitch = async () => {
    const newMode = isPaper ? 'REAL_TRADING' : 'PAPER_TRADING';
    setLoading(true);
    try {
      const result = await apiService.changeMode(newMode);
      setMessage(result.message);
    } catch {
      setMessage('Failed to switch mode');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-500 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className={isPaper ? 'text-accent-yellow' : 'text-accent-red'} />
            <span className="text-gray-200 font-semibold text-sm">Trading Mode</span>
          </div>
          <div className="text-xs text-gray-500">Broker: {broker || 'N/A'}</div>
        </div>

        <button
          onClick={handleToggle}
          className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all ${
            isPaper
              ? 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/40 hover:bg-accent-yellow/30'
              : 'bg-accent-red/20 text-accent-red border border-accent-red/40 hover:bg-accent-red/30'
          }`}
        >
          <span className={`w-2 h-2 rounded-full animate-pulse ${isPaper ? 'bg-accent-yellow' : 'bg-accent-red'}`} />
          {tradingMode === 'PAPER_TRADING' ? 'PAPER' : 'LIVE'}
        </button>
      </div>

      {message && (
        <div className="mt-3 p-2 bg-dark-600 rounded text-xs text-gray-400 font-mono">
          {message}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-700 rounded-xl border border-dark-500 p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-accent-yellow" size={20} />
              <h3 className="text-gray-200 font-semibold">Switch Trading Mode</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Switching to {isPaper ? 'REAL TRADING' : 'PAPER TRADING'} requires a server restart.
              {!isPaper && ' Real trading uses actual funds.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-dark-600 text-gray-400 rounded-lg text-sm hover:bg-dark-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSwitch}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-accent-blue/20 text-accent-blue border border-accent-blue/40 rounded-lg text-sm hover:bg-accent-blue/30 transition-colors disabled:opacity-50"
              >
                {loading ? 'Switching...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingModeToggle;
