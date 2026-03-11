// src/services/socketService.ts
import { io, Socket } from 'socket.io-client';
import type { Tick, Position, Order, AccountInfo, LogEntry, Signal, StrategyState, InitData } from '../types';

const BACKEND_URL = 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this._emit('connected', true);
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      this._emit('connected', false);
    });

    this.socket.on('init', (data: InitData) => this._emit('init', data));
    this.socket.on('tick', (tick: Tick) => this._emit('tick', tick));
    this.socket.on('positions', (positions: Position[]) => this._emit('positions', positions));
    this.socket.on('orders', (orders: Order[]) => this._emit('orders', orders));
    this.socket.on('accountInfo', (info: AccountInfo) => this._emit('accountInfo', info));
    this.socket.on('log', (log: LogEntry) => this._emit('log', log));
    this.socket.on('signal', (signal: Signal) => this._emit('signal', signal));
    this.socket.on('strategyStates', (states: StrategyState[]) => this._emit('strategyStates', states));
    this.socket.on('modeChange', (data: { mode: string }) => this._emit('modeChange', data));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private _emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }
}

export const socketService = new SocketService();
