// src/components/AccountSummary.tsx
import React from 'react';
import { useTradingStore } from '../store/zustandStore';
import { Wallet, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';

const AccountSummary: React.FC = () => {
  const accountInfo = useTradingStore((s) => s.accountInfo);

  if (!accountInfo) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {['Capital', 'Available', 'Used Margin', 'Total P&L'].map(label => (
          <div key={label} className="bg-dark-700 rounded-xl border border-dark-500 p-4 animate-pulse">
            <div className="text-gray-500 text-xs">{label}</div>
            <div className="text-xl font-mono text-gray-600 mt-1">—</div>
          </div>
        ))}
      </div>
    );
  }

  const { capital, availableMargin, usedMargin, totalPnl } = accountInfo;
  const isPnlPos = totalPnl >= 0;

  const cards = [
    {
      label: 'Capital',
      value: `₹${capital?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: <Wallet size={16} className="text-accent-blue" />,
      color: 'text-accent-blue',
    },
    {
      label: 'Available',
      value: `₹${availableMargin?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: <BarChart2 size={16} className="text-accent-green" />,
      color: 'text-accent-green',
    },
    {
      label: 'Used Margin',
      value: `₹${usedMargin?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: <BarChart2 size={16} className="text-accent-yellow" />,
      color: 'text-accent-yellow',
    },
    {
      label: 'Total P&L',
      value: `${isPnlPos ? '+' : ''}₹${totalPnl?.toFixed(2)}`,
      icon: isPnlPos ? <TrendingUp size={16} className="text-accent-green" /> : <TrendingDown size={16} className="text-accent-red" />,
      color: isPnlPos ? 'text-accent-green' : 'text-accent-red',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon, color }) => (
        <div key={label} className="bg-dark-700 rounded-xl border border-dark-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="text-gray-500 text-xs uppercase tracking-wider">{label}</span>
          </div>
          <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  );
};

export default AccountSummary;
