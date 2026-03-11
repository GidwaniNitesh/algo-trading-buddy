// src/store/zustandStore.ts
import { create } from 'zustand';
import type { Tick, Position, AccountInfo, StrategyState, LogEntry, Signal, TradingMode } from '../types';

interface TradingStore {
  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Trading mode
  tradingMode: TradingMode;
  isPaper: boolean;
  broker: string;
  setTradingMode: (mode: TradingMode) => void;
  setIsPaper: (v: boolean) => void;
  setBroker: (b: string) => void;

  // Market data
  ticks: Record<string, Tick>;
  updateTick: (tick: Tick) => void;
  setTicks: (ticks: Record<string, Tick>) => void;

  // Positions
  positions: Position[];
  setPositions: (positions: Position[]) => void;

  // Account
  accountInfo: AccountInfo | null;
  setAccountInfo: (info: AccountInfo) => void;

  // Strategies
  strategyStates: StrategyState[];
  setStrategyStates: (states: StrategyState[]) => void;
  signalCount: number;
  lastSignal: Signal | null;
  onSignal: (signal: Signal) => void;

  // Logs
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
}

export const useTradingStore = create<TradingStore>((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),

  tradingMode: 'PAPER_TRADING',
  isPaper: true,
  broker: '',
  setTradingMode: (tradingMode) => set({ tradingMode }),
  setIsPaper: (isPaper) => set({ isPaper }),
  setBroker: (broker) => set({ broker }),

  ticks: {},
  updateTick: (tick) =>
    set((state) => ({ ticks: { ...state.ticks, [tick.symbol]: tick } })),
  setTicks: (ticks) => set({ ticks }),

  positions: [],
  setPositions: (positions) => set({ positions }),

  accountInfo: null,
  setAccountInfo: (accountInfo) => set({ accountInfo }),

  strategyStates: [],
  setStrategyStates: (strategyStates) => set({ strategyStates }),
  signalCount: 0,
  lastSignal: null,
  onSignal: (signal) =>
    set((state) => ({ lastSignal: signal, signalCount: state.signalCount + 1 })),

  logs: [],
  addLog: (log) =>
    set((state) => ({ logs: [log, ...state.logs].slice(0, 200) })),
  clearLogs: () => set({ logs: [] }),
}));
