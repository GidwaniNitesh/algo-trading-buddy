// src/services/apiService.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
});

export const apiService = {
  getHealth: () => api.get('/health').then(r => r.data),
  getAccount: () => api.get('/account').then(r => r.data),
  getPositions: () => api.get('/positions').then(r => r.data),
  getOrders: () => api.get('/orders').then(r => r.data),
  getTrades: () => api.get('/trades').then(r => r.data),
  getTicks: () => api.get('/ticks').then(r => r.data),
  getStrategies: () => api.get('/strategies').then(r => r.data),
  getLogs: () => api.get('/logs').then(r => r.data),

  placeOrder: (order: { symbol: string; side: string; type: string; qty: number; price?: number }) =>
    api.post('/orders', order).then(r => r.data),

  cancelOrder: (orderId: string) =>
    api.delete(`/orders/${orderId}`).then(r => r.data),

  changeMode: (mode: string) =>
    api.post('/mode', { mode }).then(r => r.data),
};
