// src/components/OrdersTable.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/reduxStore';

const statusColors: Record<string, string> = {
  COMPLETE: 'text-accent-green bg-accent-green/10',
  PENDING: 'text-accent-yellow bg-accent-yellow/10',
  CANCELLED: 'text-gray-500 bg-gray-500/10',
  FAILED: 'text-accent-red bg-accent-red/10',
};

const sideColors: Record<string, string> = {
  BUY: 'text-accent-green',
  SELL: 'text-accent-red',
};

const OrdersTable: React.FC = () => {
  const orders = useSelector((s: RootState) => s.orders.items);

  if (orders.length === 0) {
    return (
      <div className="bg-dark-700 rounded-xl border border-dark-500">
        <div className="px-4 py-3 border-b border-dark-500">
          <h3 className="text-gray-200 font-semibold">Order History</h3>
        </div>
        <div className="p-6 text-center text-gray-500 text-sm">No orders yet</div>
      </div>
    );
  }

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-500 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500">
        <h3 className="text-gray-200 font-semibold">Order History</h3>
        <span className="text-xs text-gray-500">{orders.length} orders</span>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-dark-700">
            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-dark-500">
              {['Time', 'Symbol', 'Side', 'Type', 'Qty', 'Price', 'Strategy', 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-dark-600 hover:bg-dark-600/50 transition-colors">
                <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                  {new Date(order.created_at).toLocaleTimeString('en-IN')}
                </td>
                <td className="px-3 py-2 font-mono font-semibold text-accent-blue">{order.symbol}</td>
                <td className={`px-3 py-2 font-mono font-bold ${sideColors[order.side] || ''}`}>{order.side}</td>
                <td className="px-3 py-2 text-gray-400 font-mono text-xs">{order.type}</td>
                <td className="px-3 py-2 font-mono text-gray-300">{order.qty}</td>
                <td className="px-3 py-2 font-mono text-gray-300">
                  {order.price ? `₹${Number(order.price).toFixed(2)}` : 'MKT'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{order.strategy || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${statusColors[order.status] || ''}`}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdersTable;
