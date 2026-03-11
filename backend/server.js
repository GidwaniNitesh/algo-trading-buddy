// backend/server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const config = require('./config/config');
const logger = require('./logs/logger');
const { initDB, orders, positions, trades, logs } = require('./database/db');

const marketDataService = require('./market/marketDataService');
const strategyEngine = require('./engine/strategyEngine');
const orderManager = require('./orders/orderManager');

const PaperBroker = require('./broker/paperBroker');
const UpstoxBroker = require('./broker/upstoxBroker');

// ── App setup ──────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.server.frontendUrl,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: config.server.frontendUrl }));
app.use(express.json());

// ── Async startup ──────────────────────────────────────────
(async () => {
  // 1. Database (sql.js is async)
  await initDB();
  logger.setIO(io);

  // 2. Select broker
  let broker;
  if (config.trading.mode === 'REAL_TRADING') {
    broker = new UpstoxBroker();
    logger.info('🔴 Trading mode: REAL_TRADING');
  } else {
    broker = new PaperBroker();
    logger.info('📝 Trading mode: PAPER_TRADING');
  }

  // 3. Wire services
  orderManager.setBroker(broker);
  orderManager.setIO(io);

  strategyEngine.setOrderManager(orderManager);
  strategyEngine.setIO(io);
  strategyEngine.loadStrategies();
  strategyEngine.start();

  marketDataService.setIO(io);
  marketDataService.subscribe((tick) => {
    strategyEngine.onTick(tick);
    if (broker.isPaper()) broker.updatePrice(tick.symbol, tick.ltp);
  });
  marketDataService.start();

  // ── REST API ─────────────────────────────────────────────

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      tradingMode: config.trading.mode,
      broker: broker.getName(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/account', async (req, res) => {
    try { res.json(await broker.getAccountInfo()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/positions', async (req, res) => {
    try { res.json(await broker.getPositions()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/orders', (req, res) => {
    res.json(orders.findAll(config.trading.mode));
  });

  app.get('/api/trades', (req, res) => {
    res.json(trades.findAll(config.trading.mode));
  });

  app.get('/api/ticks', (req, res) => {
    res.json(marketDataService.getAllTicks());
  });

  app.get('/api/strategies', (req, res) => {
    res.json(strategyEngine.getInfo());
  });

  app.post('/api/orders', async (req, res) => {
    const { symbol, side, type, qty, price } = req.body;
    if (!symbol || !side || !qty) {
      return res.status(400).json({ error: 'symbol, side, and qty are required' });
    }
    res.json(await orderManager.placeManualOrder({ symbol, side, type, qty, price }));
  });

  app.delete('/api/orders/:orderId', async (req, res) => {
    res.json(await orderManager.cancelOrder(req.params.orderId));
  });

  app.get('/api/logs', (req, res) => {
    res.json(logs.findRecent(100));
  });

  app.post('/api/mode', (req, res) => {
    const { mode } = req.body;
    if (!['REAL_TRADING', 'PAPER_TRADING'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    io.emit('modeChange', { mode });
    res.json({
      message: `Mode change to ${mode} requested. Restart server to apply.`,
      currentMode: config.trading.mode,
    });
  });

  // ── Upstox OAuth ─────────────────────────────────────────

  // Step 1: Visit this URL in your browser to start OAuth login
  app.get('/auth/login', (req, res) => {
    const { apiKey, redirectUri } = config.upstox;
    if (!apiKey) {
      return res.status(400).send('UPSTOX_API_KEY not set in .env');
    }
    const url = `https://api.upstox.com/v2/login/authorization/dialog?` +
      `response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    logger.info('Redirecting to Upstox OAuth login', { url });
    res.redirect(url);
  });

  // Step 2: Upstox redirects back here with ?code=...
  // We automatically exchange the code for an access token and save it
  app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'No code in callback' });

    logger.info('Upstox OAuth callback received, exchanging code for token...');

    try {
      const resp = await require('axios').post(
        'https://api.upstox.com/v2/login/authorization/token',
        new URLSearchParams({
          code,
          client_id:     config.upstox.apiKey,
          client_secret: config.upstox.apiSecret,
          redirect_uri:  config.upstox.redirectUri,
          grant_type:    'authorization_code',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      );

      const accessToken = resp.data?.access_token;
      if (!accessToken) throw new Error('No access_token in response');

      // Update config in memory so service can use it immediately
      config.upstox.accessToken = accessToken;

      // Write to .env file so it persists across restarts
      const fs   = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

      if (envContent.includes('UPSTOX_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/UPSTOX_ACCESS_TOKEN=.*/, `UPSTOX_ACCESS_TOKEN=${accessToken}`);
      } else {
        envContent += `\nUPSTOX_ACCESS_TOKEN=${accessToken}\n`;
      }
      fs.writeFileSync(envPath, envContent);

      logger.info('✅ Upstox access token saved to .env — reconnecting market data feed');

      // Restart market data service with real token
      marketDataService.stop();
      setTimeout(() => marketDataService.start(), 1000);

      res.send(`
        <html><body style="font-family:monospace;background:#0a0e1a;color:#00d4aa;padding:40px">
          <h2>✅ Upstox Connected!</h2>
          <p>Access token saved. Real market feed is starting...</p>
          <p>Token: <code style="color:#ffd43b">${accessToken.slice(0,20)}...${accessToken.slice(-10)}</code></p>
          <p><a href="http://localhost:5173" style="color:#4dabf7">← Back to Dashboard</a></p>
        </body></html>
      `);

    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      logger.error('OAuth token exchange failed', { error: msg });
      res.status(500).send(`<html><body style="font-family:monospace;background:#0a0e1a;color:#ff4757;padding:40px">
        <h2>❌ Token Exchange Failed</h2>
        <pre>${msg}</pre>
        <p><a href="/auth/login" style="color:#4dabf7">Try again</a></p>
      </body></html>`);
    }
  });

  // Token status
  app.get('/api/auth/status', (req, res) => {
    const hasToken = !!(config.upstox.accessToken && config.upstox.accessToken.length > 20
                       && config.upstox.accessToken !== 'your_access_token_here');
    res.json({
      hasToken,
      isLiveData:   marketDataService.isConnected,
      isMockData:   !hasToken || !marketDataService.isConnected,
      loginUrl:     `http://localhost:${config.server.port}/auth/login`,
      tokenPreview: hasToken ? config.upstox.accessToken.slice(0, 12) + '...' : null,
    });
  });

  // ── Socket.IO ────────────────────────────────────────────

  io.on('connection', async (socket) => {
    logger.info(`Socket client connected: ${socket.id}`);

    const ticks = marketDataService.getAllTicks();
    const pos = await broker.getPositions();
    const acct = await broker.getAccountInfo();

    socket.emit('init', {
      tradingMode: config.trading.mode,
      broker: broker.getName(),
      isPaper: broker.isPaper(),
      ticks,
      positions: pos,
      orders: orders.findAll(config.trading.mode),
      trades: trades.findAll(config.trading.mode),
      accountInfo: acct,
      strategies: strategyEngine.getInfo(),
    });

    socket.on('disconnect', () => {
      logger.info(`Socket client disconnected: ${socket.id}`);
    });
  });

  // ── Periodic broadcast ───────────────────────────────────

  setInterval(async () => {
    const acct = await broker.getAccountInfo();
    const pos = await broker.getPositions();
    io.emit('accountInfo', acct);
    io.emit('positions', pos);
  }, 5000);

  // ── Start server ─────────────────────────────────────────

  const PORT = config.server.port;
  server.listen(PORT, () => {
    logger.info(`🚀 Trading Platform running on http://localhost:${PORT}`);
    logger.info(`Mode: ${config.trading.mode} | Broker: ${broker.getName()}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    marketDataService.stop();
    server.close();
  });

})().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
