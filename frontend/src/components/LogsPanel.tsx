// src/components/LogsPanel.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useTradingStore } from '../store/zustandStore';
import { Terminal, Trash2 } from 'lucide-react';

const levelStyles: Record<string, string> = {
  info: 'text-accent-blue',
  warn: 'text-accent-yellow',
  error: 'text-accent-red',
};

const LogsPanel: React.FC = () => {
  const { logs, clearLogs } = useTradingStore((s) => ({ logs: s.logs, clearLogs: s.clearLogs }));
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter);

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-500 overflow-hidden flex flex-col h-56">
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-500 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-accent-green" />
          <h3 className="text-gray-200 font-semibold text-sm">System Logs</h3>
          <span className="text-xs text-gray-500">({logs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'info', 'warn', 'error'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                filter === f
                  ? 'bg-dark-500 text-gray-200'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={clearLogs}
            className="text-gray-500 hover:text-accent-red transition-colors ml-2"
          >
            <Trash2 size={14} />
          </button>
          <label className="flex items-center gap-1 text-xs text-gray-500 ml-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            auto
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-gray-600 italic">No logs yet...</div>
        ) : (
          filtered.map((log, i) => (
            <div key={i} className="flex gap-2 hover:bg-dark-600/30 px-1 rounded">
              <span className="text-gray-600 flex-shrink-0">
                {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
              </span>
              <span className={`flex-shrink-0 uppercase font-bold w-8 ${levelStyles[log.level] || 'text-gray-400'}`}>
                {log.level.slice(0, 3)}
              </span>
              <span className="text-gray-300 break-all">{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogsPanel;
