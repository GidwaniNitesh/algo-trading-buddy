# AlgoTrader Pro — NIFTY & BANKNIFTY Algorithmic Trading Platform

A scalable, production-ready prototype algorithmic trading platform for Indian markets built with Node.js, React, and the Upstox API.

---

## 🏗️ Project Structure

```
trading-platform/
├── backend/
│   ├── broker/
│   │   ├── brokerInterface.js      # Abstract broker interface
│   │   ├── paperBroker.js          # Paper trading simulator
│   │   └── upstoxBroker.js         # Real Upstox broker integration
│   ├── config/
│   │   └── config.js               # All configuration
│   ├── database/
│   │   └── db.js                   # SQLite abstraction layer
│   ├── engine/
│   │   └── strategyEngine.js       # Plugin-based strategy engine
│   ├── logs/
│   │   └── logger.js               # Winston logger + Socket.IO emitter
│   ├── market/
│   │   └── marketDataService.js    # Upstox WebSocket + mock feed
│   ├── orders/
│   │   └── orderManager.js         # Signal → Order → Broker pipeline
│   ├── strategies/
│   │   ├── emaStrategy.js          # EMA Crossover strategy
│   │   ├── rsiStrategy.js          # RSI overbought/oversold strategy
│   │   └── vwapStrategy.js         # VWAP crossover strategy
│   ├── .env                        # Environment config
│   ├── package.json
│   └── server.js                   # Express + Socket.IO server
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AccountSummary.tsx
    │   │   ├── LogsPanel.tsx
    │   │   ├── ManualOrderPanel.tsx
    │   │   ├── OrdersTable.tsx
    │   │   ├── PositionsTable.tsx
    │   │   ├── PriceTicker.tsx
    │   │   ├── StrategyStatus.tsx
    │   │   ├── TradingChart.tsx       # TradingView Lightweight Charts
    │   │   └── TradingModeToggle.tsx
    │   ├── pages/
    │   │   └── Dashboard.tsx
    │   ├── services/
    │   │   ├── apiService.ts          # REST API client
    │   │   └── socketService.ts       # Socket.IO client
    │   ├── store/
    │   │   ├── reduxStore.ts          # Redux for orders/trades
    │   │   └── zustandStore.ts        # Zustand for real-time state
    │   ├── types/
    │   │   └── index.ts               # TypeScript types
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    └── vite.config.ts
```

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### 2. Configure environment

Edit `backend/.env`:

```env
# Choose trading mode
TRADING_MODE=PAPER_TRADING    # or REAL_TRADING

# For real trading, add Upstox credentials
UPSTOX_API_KEY=your_api_key
UPSTOX_API_SECRET=your_api_secret
UPSTOX_ACCESS_TOKEN=your_access_token

# Paper trading capital
PAPER_CAPITAL=100000
```

### 3. Start backend

```bash
cd backend
npm run dev
# Server runs on http://localhost:3001
```

### 4. Start frontend

```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

---

## 📊 Trading Modes

### Paper Trading (Default)
- Starts with ₹1,00,000 virtual capital
- Uses live market prices (or mock prices if no token)
- Simulates fills at market price
- Tracks positions, P&L, and trade history
- Safe to use without Upstox credentials

### Real Trading
- Uses Upstox REST API to place actual orders
- Requires valid Upstox access token
- Set `TRADING_MODE=REAL_TRADING` in `.env`

**Switching modes requires a server restart.**

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/account` | Account info & balance |
| GET | `/api/positions` | Open positions |
| GET | `/api/orders` | Order history |
| GET | `/api/trades` | Trade history |
| GET | `/api/ticks` | Latest market prices |
| GET | `/api/strategies` | Strategy engine status |
| GET | `/api/logs` | Recent logs |
| POST | `/api/orders` | Place manual order |
| DELETE | `/api/orders/:id` | Cancel order |
| POST | `/api/mode` | Request mode switch |

---

## 🧠 Strategy System

### Adding a New Strategy

1. Create `backend/strategies/myStrategy.js`:

```js
class MyStrategy {
  constructor() {
    this.name = 'MyStrategy';
    this.config = {};
  }

  init(config) {
    this.config = config;
    return this;
  }

  onTick(tick) {
    // Return a signal or null
    if (/* your condition */) {
      return {
        strategy: this.name,
        signal: 'BUY',       // or 'SELL'
        symbol: this.config.symbol,
        qty: this.config.qty,
        type: 'MARKET',
        meta: { reason: 'your_reason' }
      };
    }
    return null;
  }

  onCandle(candle) {
    return null;
  }

  getState() {
    return { name: this.name, symbol: this.config.symbol };
  }
}

module.exports = MyStrategy;
```

2. Register it in `backend/config/config.js`:

```js
strategies: {
  myStrategy: {
    enabled: true,
    symbol: 'NIFTY',
    qty: 50,
  }
}
```

3. Load it in `backend/engine/strategyEngine.js`:

```js
const MyStrategy = require('../strategies/myStrategy');
// Inside loadStrategies():
if (config.strategies.myStrategy.enabled) {
  this.strategies.push(new MyStrategy().init(config.strategies.myStrategy));
}
```

---

## 🔌 Socket.IO Events

### Backend → Frontend

| Event | Data |
|-------|------|
| `init` | Full initial state |
| `tick` | Live price tick |
| `positions` | Updated positions |
| `orders` | Updated orders |
| `accountInfo` | Balance & P&L |
| `signal` | Strategy signal generated |
| `strategyStates` | All strategy states |
| `log` | Log entry |

---

## 🏦 Getting Real Market Data (Upstox)

Both PAPER and REAL trading use the same live Upstox feed for prices.
Set this up once — it works for paper trading too.

### Step 1 — Create a free Upstox developer app

1. Go to https://developer.upstox.com and log in with your Upstox account
2. Click **Create New App**
3. Set **Redirect URL** to: `http://localhost:3001/auth/callback`
4. Copy your **API Key** and **API Secret** into `backend/.env`:

```env
UPSTOX_API_KEY=your_api_key_here
UPSTOX_API_SECRET=your_api_secret_here
```

### Step 2 — Get your access token (one-click)

Start the backend server, then open this URL in your browser:

```
http://localhost:3001/auth/login
```

This redirects you to Upstox login → you authorize → the token is **automatically saved** to your `.env` file and the live feed starts immediately. No manual copy-paste needed.

### Step 3 — Verify

The dashboard header shows **● LIVE** (green) when real data is flowing.
It shows **⚠ MOCK DATA** (yellow) when no token is set.

### Token expiry

Upstox access tokens expire daily. Re-visit `http://localhost:3001/auth/login` each morning to refresh.

### What works without a token

The platform runs fully in mock mode with simulated NIFTY/BANKNIFTY prices. All features (strategies, paper trading, charts, order markers) work — just with fake prices.

---

## 🗄️ Database Schema

SQLite tables:
- **orders** — All order records
- **positions** — Open positions
- **trades** — Completed trades with P&L
- **logs** — System logs
- **candles** — OHLCV candle data

Database file: `backend/database/trading.db`

---

## ⚙️ Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express, Socket.IO |
| Frontend | React, Vite, TypeScript, Tailwind |
| State | Redux Toolkit + Zustand |
| Charts | TradingView Lightweight Charts |
| Database | SQLite (better-sqlite3) |
| Logging | Winston |
| Broker API | Upstox REST + WebSocket |
