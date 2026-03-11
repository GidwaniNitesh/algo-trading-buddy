// src/store/reduxStore.ts
import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Order, Trade } from '../types';

// Orders slice
const ordersSlice = createSlice({
  name: 'orders',
  initialState: { items: [] as Order[] },
  reducers: {
    setOrders(state, action: PayloadAction<Order[]>) {
      state.items = action.payload;
    },
    addOrder(state, action: PayloadAction<Order>) {
      state.items.unshift(action.payload);
    },
  },
});

// Trades slice
const tradesSlice = createSlice({
  name: 'trades',
  initialState: { items: [] as Trade[] },
  reducers: {
    setTrades(state, action: PayloadAction<Trade[]>) {
      state.items = action.payload;
    },
  },
});

export const { setOrders, addOrder } = ordersSlice.actions;
export const { setTrades } = tradesSlice.actions;

export const reduxStore = configureStore({
  reducer: {
    orders: ordersSlice.reducer,
    trades: tradesSlice.reducer,
  },
});

export type RootState = ReturnType<typeof reduxStore.getState>;
export type AppDispatch = typeof reduxStore.dispatch;
