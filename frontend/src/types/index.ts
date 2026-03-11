// src/types/index.ts

export type TradingMode = 'REAL_TRADING' | 'PAPER_TRADING';

export interface Tick {
  symbol: string;
  instrumentKey: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
  isMock?: boolean;
}

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  tradingMode: TradingMode;
}

export interface Order {
  id: string;
  broker_order_id?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  qty: number;
  price?: number;
  status: 'PENDING' | 'COMPLETE' | 'CANCELLED' | 'FAILED';
  strategy?: string;
  trading_mode: TradingMode;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  order_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  pnl: number;
  strategy?: string;
  trading_mode: TradingMode;
  executed_at: string;
}

export interface AccountInfo {
  capital: number;
  usedMargin: number;
  availableMargin: number;
  totalPnl: number;
  tradingMode: TradingMode;
}

export interface StrategyState {
  name: string;
  symbol: string;
  inPosition: boolean;
  [key: string]: unknown;
}

export interface Signal {
  strategy: string;
  signal: 'BUY' | 'SELL';
  symbol: string;
  qty: number;
  type: 'MARKET' | 'LIMIT';
  meta?: Record<string, string>;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface InitData {
  tradingMode: TradingMode;
  broker: string;
  isPaper: boolean;
  ticks: Record<string, Tick>;
  positions: Position[];
  orders: Order[];
  trades: Trade[];
  accountInfo: AccountInfo;
  strategies: {
    isRunning: boolean;
    strategyCount: number;
    signalCount: number;
    strategies: StrategyState[];
  };
}
