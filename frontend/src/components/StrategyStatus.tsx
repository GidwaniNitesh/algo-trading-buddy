// src/components/StrategyStatus.tsx
import React from 'react';
import { useTradingStore } from '../store/zustandStore';
import { Zap, CheckCircle, XCircle } from 'lucide-react';

const StrategyStatus: React.FC = () => {
  const { strategyStates, lastSignal, signalCount } = useTradingStore((s) => ({
    strategyStates: s.strategyStates,
    lastSignal: s.lastSignal,
    signalCount: s.signalCount,
  }));

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-500">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-accent-yellow" />
          <h3 className="text-gray-200 font-semibold">Strategies</h3>
        </div>
        <span className="text-xs text-gray-500">
          {signalCount} signals generated
        </span>
      </div>

      <div className="p-4 space-y-3">
        {strategyStates.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">Loading strategies...</p>
        ) : (
          strategyStates.map((strategy) => (
            <div key={strategy.name} className="bg-dark-600 rounded-lg p-3 border border-dark-500">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {strategy.inPosition ? (
                    <CheckCircle size={14} className="text-accent-green" />
                  ) : (
                    <XCircle size={14} className="text-gray-500" />
                  )}
                  <span className="font-semibold text-sm text-gray-200">{strategy.name}</span>
                  <span className="text-xs text-gray-500 font-mono">{strategy.symbol}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                  strategy.inPosition
                    ? 'text-accent-green bg-accent-green/10'
                    : 'text-gray-500 bg-gray-500/10'
                }`}>
                  {strategy.inPosition ? 'IN POSITION' : 'FLAT'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                {Object.entries(strategy)
                  .filter(([k]) => !['name', 'symbol', 'inPosition'].includes(k))
                  .map(([key, val]) => (
                    <div key={key} className="flex gap-1">
                      <span className="text-gray-500">{key}:</span>
                      <span className="text-gray-300">{String(val)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}

        {lastSignal && (
          <div className={`rounded-lg p-3 border ${
            lastSignal.signal === 'BUY'
              ? 'bg-accent-green/10 border-accent-green/30'
              : 'bg-accent-red/10 border-accent-red/30'
          }`}>
            <div className="text-xs text-gray-500 mb-1">Last Signal</div>
            <div className={`font-mono font-bold ${lastSignal.signal === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>
              {lastSignal.signal} {lastSignal.qty} {lastSignal.symbol}
              <span className="text-xs text-gray-400 ml-2">via {lastSignal.strategy}</span>
            </div>
            {lastSignal.meta && (
              <div className="mt-1 text-xs text-gray-500 font-mono">
                {Object.entries(lastSignal.meta).map(([k, v]) => `${k}: ${v}`).join(' | ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyStatus;
