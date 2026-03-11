// src/components/PositionsTable.tsx
import React from 'react';
import { useTradingStore } from '../store/zustandStore';
import { TrendingUp, TrendingDown } from 'lucide-react';

const PositionsTable: React.FC = () => {
  const positions = useTradingStore((s) => s.positions);

  if (positions.length === 0) {
    return (
      <div className="bg-dark-700 rounded-xl border border-dark-500">
        <div className="px-4 py-3 border-b border-dark-500">
          <h3 className="text-gray-200 font-semibold">Open Positions</h3>
        </div>
        <div className="p-6 text-center text-gray-500 text-sm">No open positions</div>
      </div>
    );
  }

  const totalPnl = positions.reduce((acc, p) => acc + p.pnl, 0);

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-500 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500">
        <h3 className="text-gray-200 font-semibold">Open Positions</h3>
        <span className={`text-sm font-mono font-bold ${totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          Total P&L: {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-dark-500">
              {['Symbol', 'Qty', 'Avg Price', 'LTP', 'P&L', 'P&L %'].map(h => (
                <th key={h} className="px-4 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const pnlPct = ((pos.ltp - pos.avgPrice) / pos.avgPrice * 100);
              const isUp = pos.pnl >= 0;
              return (
                <tr key={pos.symbol} className="border-b border-dark-600 hover:bg-dark-600/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-accent-blue">{pos.symbol}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">{pos.qty}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">₹{pos.avgPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-gray-200">₹{pos.ltp.toFixed(2)}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
                    <div className="flex items-center gap-1">
                      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {isUp ? '+' : ''}₹{pos.pnl.toFixed(2)}
                    </div>
                  </td>
                  <td className={`px-4 py-3 font-mono ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
                    {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PositionsTable;
