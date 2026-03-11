// backend/config/config.js
require('dotenv').config();

const config = {
  trading: {
    mode: process.env.TRADING_MODE || 'PAPER_TRADING', // REAL_TRADING | PAPER_TRADING
    symbols: ['NSE_INDEX|Nifty 50', 'NSE_INDEX|Nifty Bank'],
    symbolNames: {
      'NSE_INDEX|Nifty 50': 'NIFTY',
      'NSE_INDEX|Nifty Bank': 'BANKNIFTY',
    },
  },

  server: {
    port: parseInt(process.env.PORT) || 3001,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  upstox: {
    apiKey: process.env.UPSTOX_API_KEY || '',
    apiSecret: process.env.UPSTOX_API_SECRET || '',
    redirectUri: process.env.UPSTOX_REDIRECT_URI || 'http://localhost:3001/auth/callback',
    accessToken: process.env.UPSTOX_ACCESS_TOKEN || '',
    baseUrl: 'https://api.upstox.com/v2',
    wsUrl: 'wss://api.upstox.com/v2/feed/market-data-feed',
  },

  paper: {
    initialCapital: parseFloat(process.env.PAPER_CAPITAL) || 100000,
  },

  database: {
    path: process.env.DB_PATH || './database/trading.db',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  strategies: {
    ema: {
      enabled: true,
      fastPeriod: 9,
      slowPeriod: 21,
      symbol: 'NIFTY',
      qty: 50,
    },
    rsi: {
      enabled: true,
      period: 14,
      oversold: 30,
      overbought: 70,
      symbol: 'BANKNIFTY',
      qty: 15,
    },
    vwap: {
      enabled: true,
      symbol: 'NIFTY',
      qty: 50,
    },
  },
};

module.exports = config;
