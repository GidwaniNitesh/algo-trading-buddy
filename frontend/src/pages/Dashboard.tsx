// src/pages/Dashboard.tsx
import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { socketService } from '../services/socketService';
import { useTradingStore } from '../store/zustandStore';
import { setOrders } from '../store/reduxStore';
import type { AppDispatch } from '../store/reduxStore';
import type { InitData, Tick, Position, Order, AccountInfo, LogEntry, Signal, StrategyState } from '../types';

import PriceTicker from '../components/PriceTicker';
import TradingChart from '../components/TradingChart';
import PositionsTable from '../components/PositionsTable';
import OrdersTable from '../components/OrdersTable';
import StrategyStatus from '../components/StrategyStatus';
import TradingModeToggle from '../components/TradingModeToggle';
import LogsPanel from '../components/LogsPanel';
import AccountSummary from '../components/AccountSummary';
import ManualOrderPanel from '../components/ManualOrderPanel';
import { Activity, Wifi, WifiOff } from 'lucide-react';

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const store = useTradingStore();

  useEffect(() => {
    socketService.connect();

    const unsubs = [
      socketService.on('connected', (v: boolean) => store.setConnected(v)),

      socketService.on('init', (data: InitData) => {
        store.setTradingMode(data.tradingMode);
        store.setIsPaper(data.isPaper);
        store.setBroker(data.broker);
        store.setTicks(data.ticks);
        store.setPositions(data.positions);
        store.setAccountInfo(data.accountInfo);
        store.setStrategyStates(data.strategies?.strategies || []);
        dispatch(setOrders(data.orders));
        store.addLog({ level: 'info', message: `Connected to backend | Mode: ${data.tradingMode}`, timestamp: new Date().toISOString() });
      }),

      socketService.on('tick', (tick: Tick) => store.updateTick(tick)),
      socketService.on('positions', (positions: Position[]) => store.setPositions(positions)),
      socketService.on('orders', (orders: Order[]) => dispatch(setOrders(orders))),
      socketService.on('accountInfo', (info: AccountInfo) => store.setAccountInfo(info)),
      socketService.on('log', (log: LogEntry) => store.addLog(log)),
      socketService.on('signal', (signal: Signal) => store.onSignal(signal)),
      socketService.on('strategyStates', (states: StrategyState[]) => store.setStrategyStates(states)),
    ];

    return () => {
      unsubs.forEach(fn => typeof fn === 'function' && fn());
      socketService.disconnect();
    };
  }, []);

  const { connected, tradingMode, isPaper } = store;

  // Track whether we have real live data or mock
  const [feedStatus, setFeedStatus] = React.useState<{isLive: boolean; isMock: boolean} | null>(null);
  React.useEffect(() => {
    const check = () =>
      fetch('http://localhost:3001/api/auth/status')
        .then(r => r.json())
        .then(d => setFeedStatus({ isLive: d.isLiveData, isMock: d.isMockData }))
        .catch(() => {});
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-dark-900 text-gray-100" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-500 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-accent-blue/20 border border-accent-blue/40 rounded-lg flex items-center justify-center">
              <Activity size={14} className="text-accent-blue" />
            </div>
            <span className="font-bold text-gray-100 tracking-tight">AlgoTrader Pro</span>
          </div>
          <span className="text-dark-500 select-none">|</span>
          <span className="text-xs text-gray-500 font-mono">NIFTY & BANKNIFTY</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Trading mode badge */}
          <div className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full ${
            isPaper
              ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30'
              : 'bg-accent-red/10 text-accent-red border border-accent-red/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isPaper ? 'bg-accent-yellow' : 'bg-accent-red'}`} />
            {tradingMode === 'PAPER_TRADING' ? 'PAPER' : 'LIVE TRADING'}
          </div>

          {/* Feed status */}
          {feedStatus ? (
            feedStatus.isLive ? (
              <div className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                LIVE FEED
              </div>
            ) : (
              <a
                href="http://localhost:3001/auth/login"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 hover:bg-accent-yellow/20 transition-colors cursor-pointer"
                title="Click to connect Upstox for real market data"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />
                MOCK FEED · Connect Live →
              </a>
            )
          ) : null}

          {/* WS connection */}
          <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-accent-green' : 'text-accent-red'}`}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="font-mono">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="p-4 lg:p-6 space-y-4 max-w-[1800px] mx-auto">
        {/* Account Summary */}
        <AccountSummary />

        {/* Price Tickers */}
        <PriceTicker />

        {/* Chart + Side Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <TradingChart />
          </div>
          <div className="space-y-4">
            <TradingModeToggle />
            <ManualOrderPanel />
          </div>
        </div>

        {/* Strategy Status */}
        <StrategyStatus />

        {/* Positions */}
        <PositionsTable />

        {/* Orders */}
        <OrdersTable />

        {/* Logs */}
        <LogsPanel />
      </main>
    </div>
  );
};

export default Dashboard;
