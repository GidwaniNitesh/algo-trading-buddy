// src/components/PriceTicker.tsx
import React from 'react';
import { useTradingStore } from '../store/zustandStore';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface PriceCardProps {
  symbol: string;
  color: string;
}

const PriceCard: React.FC<PriceCardProps> = ({ symbol, color }) => {
  const tick = useTradingStore((s) => s.ticks[symbol]);

  if (!tick) {
    return (
      <div className="bg-dark-700 rounded-xl p-4 border border-dark-500 animate-pulse">
        <div className="text-gray-500 text-sm">{symbol}</div>
        <div className="text-2xl font-mono text-gray-600 mt-1">Loading...</div>
      </div>
    );
  }

  const change = tick.ltp - tick.open;
  const changePct = ((change / tick.open) * 100);
  const isUp = change >= 0;

  return (
    <div className={`bg-dark-700 rounded-xl p-4 border ${isUp ? 'border-accent-green/30' : 'border-accent-red/30'} transition-all duration-300`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={14} className={color} />
            <span className="text-gray-300 text-sm font-semibold tracking-wider">{symbol}</span>
            {tick.isLive ? (
              <span className="text-xs bg-green-900/40 text-accent-green px-1.5 py-0.5 rounded font-bold">● LIVE</span>
            ) : (
              <span className="text-xs bg-yellow-900/40 text-yellow-400 px-1.5 py-0.5 rounded">MOCK</span>
            )}
          </div>
          <div className={`text-3xl font-mono font-bold mt-1 ${color}`}>
            ₹{tick.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className={`flex flex-col items-end ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
          {isUp ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          <span className="text-sm font-mono mt-1">
            {isUp ? '+' : ''}{change.toFixed(2)}
          </span>
          <span className="text-xs font-mono">
            ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-dark-500">
        {[
          { label: 'H', value: tick.high, color: 'text-accent-green' },
          { label: 'L', value: tick.low, color: 'text-accent-red' },
          { label: 'O', value: tick.open, color: 'text-gray-400' },
        ].map(({ label, value, color: c }) => (
          <div key={label}>
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-xs font-mono ${c}`}>{value.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PriceTicker: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <PriceCard symbol="NIFTY" color="text-accent-blue" />
      <PriceCard symbol="BANKNIFTY" color="text-accent-purple" />
    </div>
  );
};

export default PriceTicker;
