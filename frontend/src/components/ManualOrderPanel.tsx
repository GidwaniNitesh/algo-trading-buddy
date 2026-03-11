// src/components/ManualOrderPanel.tsx
import React, { useState } from 'react';
import { apiService } from '../services/apiService';
import { Send } from 'lucide-react';

const ManualOrderPanel: React.FC = () => {
  const [symbol, setSymbol] = useState('NIFTY');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [qty, setQty] = useState(50);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleSubmit = async () => {
    setLoading(true);
    setResult('');
    try {
      const res = await apiService.placeOrder({
        symbol,
        side,
        type,
        qty,
        price: type === 'LIMIT' ? parseFloat(price) : undefined,
      });
      setResult(res.success ? `✓ ${res.message}` : `✗ ${res.message}`);
    } catch (err: any) {
      setResult(`✗ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-500 p-4">
      <h3 className="text-gray-200 font-semibold text-sm mb-3 flex items-center gap-2">
        <Send size={14} className="text-accent-blue" />
        Manual Order
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Symbol</label>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="w-full bg-dark-600 border border-dark-400 rounded px-2 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-accent-blue"
          >
            <option>NIFTY</option>
            <option>BANKNIFTY</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Side</label>
          <div className="flex gap-1">
            {(['BUY', 'SELL'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`flex-1 py-1.5 rounded text-sm font-mono font-bold transition-all ${
                  side === s
                    ? s === 'BUY'
                      ? 'bg-accent-green/20 text-accent-green border border-accent-green/50'
                      : 'bg-accent-red/20 text-accent-red border border-accent-red/50'
                    : 'bg-dark-600 text-gray-500 border border-dark-400 hover:border-gray-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Type</label>
          <div className="flex gap-1">
            {(['MARKET', 'LIMIT'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded text-xs font-mono transition-all ${
                  type === t
                    ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/50'
                    : 'bg-dark-600 text-gray-500 border border-dark-400 hover:border-gray-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Qty</label>
          <input
            type="number"
            value={qty}
            onChange={e => setQty(parseInt(e.target.value) || 1)}
            min={1}
            className="w-full bg-dark-600 border border-dark-400 rounded px-2 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-accent-blue"
          />
        </div>

        {type === 'LIMIT' && (
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Price (₹)</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="Enter limit price"
              className="w-full bg-dark-600 border border-dark-400 rounded px-2 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-accent-blue"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-2 rounded-lg font-mono font-bold text-sm transition-all disabled:opacity-50 ${
          side === 'BUY'
            ? 'bg-accent-green/20 text-accent-green border border-accent-green/50 hover:bg-accent-green/30'
            : 'bg-accent-red/20 text-accent-red border border-accent-red/50 hover:bg-accent-red/30'
        }`}
      >
        {loading ? 'Placing...' : `Place ${side} Order`}
      </button>

      {result && (
        <div className={`mt-2 p-2 rounded text-xs font-mono ${
          result.startsWith('✓') ? 'text-accent-green bg-accent-green/10' : 'text-accent-red bg-accent-red/10'
        }`}>
          {result}
        </div>
      )}
    </div>
  );
};

export default ManualOrderPanel;
