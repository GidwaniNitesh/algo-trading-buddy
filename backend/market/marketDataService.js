// backend/market/marketDataService.js
//
// Connects to Upstox WebSocket v3 market data feed (protobuf binary).
// For PAPER_TRADING mode — uses real live prices, simulated order fills.
// Falls back to mock feed ONLY when market is closed OR no token is set.

const WebSocket = require('ws');
const axios     = require('axios');
const logger    = require('../logs/logger');
const config    = require('../config/config');

// ── Upstox Protobuf decoder ──────────────────────────────────────────────────
// Upstox v3 WebSocket sends a custom binary protobuf.
// We implement a minimal hand-rolled decoder for the fields we need
// (ltp, open, high, low, close, volume, instrument_key).
// Full schema: https://github.com/upstox/upstox-python/blob/master/upstox_client/feeder/MarketDataFeed.proto

function decodeUpstoxProto(buffer) {
  // Upstox wraps their feed in a lightweight envelope:
  // Field 1 (varint): feeds count  [not used, we iterate manually]
  // Field 2 (len-delimited): map<string, FullFeedResponse>
  //
  // Each FullFeedResponse contains:
  //   Field 1: MarketFullFeed (ff)
  //     Field 1: LTPC { ltp, ltt, ltq, cp }
  //     Field 6: MarketOHLC { ohlc[] { interval, open, high, low, close, vol, ts } }
  //     Field 9: OptionGreeks (ignore)
  //
  // Since protobuf wire format is self-describing, we parse key fields.

  const ticks = {};

  try {
    let pos = 0;
    const view = new DataView(buffer.buffer || buffer);
    const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

    // Upstox actually sends JSON-encoded protobuf in their v2 HTTP API
    // but raw binary proto in WebSocket. We'll use a field-tag parser.

    function readVarint() {
      let result = 0n, shift = 0n;
      while (pos < bytes.length) {
        const b = bytes[pos++];
        result |= BigInt(b & 0x7F) << shift;
        shift += 7n;
        if ((b & 0x80) === 0) break;
      }
      return Number(result);
    }

    function readBytes() {
      const len = readVarint();
      const slice = bytes.slice(pos, pos + len);
      pos += len;
      return slice;
    }

    function readFloat() {
      const val = bytes.readFloatLE(pos);
      pos += 4;
      return parseFloat(val.toFixed(2));
    }

    function readDouble() {
      const val = bytes.readDoubleLE(pos);
      pos += 8;
      return parseFloat(val.toFixed(2));
    }

    function skipField(wireType) {
      if      (wireType === 0) readVarint();
      else if (wireType === 1) { pos += 8; }
      else if (wireType === 2) readBytes();
      else if (wireType === 5) { pos += 4; }
    }

    // Parse LTPC sub-message { ltp(1), ltt(2), ltq(3), cp(4) }
    function parseLTPC(buf) {
      let p = 0, ltp = 0, cp = 0;
      while (p < buf.length) {
        const tag  = buf[p++];
        const fnum = tag >> 3, wt = tag & 0x7;
        if (fnum === 1 && wt === 5) { ltp = buf.readFloatLE(p); p += 4; }
        else if (fnum === 4 && wt === 5) { cp = buf.readFloatLE(p); p += 4; }
        else {
          // skip
          if      (wt === 0) { while (buf[p++] & 0x80); }
          else if (wt === 1) p += 8;
          else if (wt === 2) { let l=0,s=0; while(true){const b=buf[p++];l|=(b&0x7F)<<s;s+=7;if(!(b&0x80))break;} p+=l; }
          else if (wt === 5) p += 4;
        }
      }
      return { ltp: parseFloat(ltp.toFixed(2)), cp: parseFloat(cp.toFixed(2)) };
    }

    // Parse OHLCV sub-message (first interval = day candle)
    function parseOHLC(buf) {
      let p = 0, o = 0, h = 0, l = 0, c = 0, vol = 0;
      while (p < buf.length) {
        const tag  = buf[p++];
        const fnum = tag >> 3, wt = tag & 0x7;
        if      (fnum === 2 && wt === 5) { o = buf.readFloatLE(p); p += 4; }
        else if (fnum === 3 && wt === 5) { h = buf.readFloatLE(p); p += 4; }
        else if (fnum === 4 && wt === 5) { l = buf.readFloatLE(p); p += 4; }
        else if (fnum === 5 && wt === 5) { c = buf.readFloatLE(p); p += 4; }
        else if (fnum === 6 && wt === 0) { let v=0,s=0; while(true){const b=buf[p++];v|=(b&0x7F)<<s;s+=7;if(!(b&0x80))break;} vol=v; }
        else {
          if      (wt === 0) { while (buf[p++] & 0x80); }
          else if (wt === 1) p += 8;
          else if (wt === 2) { let ln=0,sh=0; while(true){const b=buf[p++];ln|=(b&0x7F)<<sh;sh+=7;if(!(b&0x80))break;} p+=ln; }
          else if (wt === 5) p += 4;
        }
      }
      return { open: parseFloat(o.toFixed(2)), high: parseFloat(h.toFixed(2)),
               low: parseFloat(l.toFixed(2)), close: parseFloat(c.toFixed(2)), volume: vol };
    }

    // Top-level: map<string instrumentKey, FullFeedResponse>
    while (pos < bytes.length) {
      const tag    = readVarint();
      const fnum   = tag >> 3;
      const wt     = tag & 0x7;

      if (fnum === 1 && wt === 2) {
        // Key = instrument key string
        const keyBuf = readBytes();
        const instrumentKey = keyBuf.toString('utf8');

        // Next field should be value (FullFeedResponse)
        const tag2 = readVarint();
        const fnum2 = tag2 >> 3, wt2 = tag2 & 0x7;
        if (wt2 !== 2) { skipField(wt2); continue; }

        const feedBuf = readBytes();
        let fp = 0;
        let ltp = 0, cp = 0, open = 0, high = 0, low = 0, close = 0, vol = 0;

        // Parse FullFeedResponse { ff(1): MarketFullFeed }
        while (fp < feedBuf.length) {
          const t = feedBuf[fp++];
          const fn = t >> 3, fw = t & 0x7;
          if (fn === 1 && fw === 2) {
            // MarketFullFeed
            const mfLen = (() => { let r=0,s=0; while(true){const b=feedBuf[fp++];r|=(b&0x7F)<<s;s+=7;if(!(b&0x80))break;} return r; })();
            const mf = feedBuf.slice(fp, fp + mfLen); fp += mfLen;
            let mp = 0;
            while (mp < mf.length) {
              const mt = mf[mp++];
              const mfn = mt >> 3, mfw = mt & 0x7;
              if (mfn === 1 && mfw === 2) {
                // LTPC
                const l2 = (() => { let r=0,s=0; while(true){const b=mf[mp++];r|=(b&0x7F)<<s;s+=7;if(!(b&0x80))break;} return r; })();
                const ltpc = parseLTPC(mf.slice(mp, mp + l2)); mp += l2;
                ltp = ltpc.ltp; cp = ltpc.cp;
              } else if (mfn === 6 && mfw === 2) {
                // MarketOHLC — contains repeated ohlc entries; take first (day)
                const l3 = (() => { let r=0,s=0; while(true){const b=mf[mp++];r|=(b&0x7F)<<s;s+=7;if(!(b&0x80))break;} return r; })();
                const ohlcOuter = mf.slice(mp, mp + l3); mp += l3;
                let op = 0;
                while (op < ohlcOuter.length) {
                  const ot = ohlcOuter[op++];
                  const ofn = ot >> 3, ofw = ot & 0x7;
                  if (ofn === 1 && ofw === 2) {
                    const l4 = (() => { let r=0,s=0; while(true){const b=ohlcOuter[op++];r|=(b&0x7F)<<s;s+=7;if(!(b&0x80))break;} return r; })();
                    const ohlc = parseOHLC(ohlcOuter.slice(op, op + l4)); op += l4;
                    if (ohlc.open && !open) { open=ohlc.open; high=ohlc.high; low=ohlc.low; close=ohlc.close; vol=ohlc.volume; }
                  } else {
                    if      (ofw === 0) { while (ohlcOuter[op++] & 0x80); }
                    else if (ofw === 1) op += 8;
                    else if (ofw === 2) { let ln=0,sh=0; while(true){const b=ohlcOuter[op++];ln|=(b&0x7F)<<sh;sh+=7;if(!(b&0x80))break;} op+=ln; }
                    else if (ofw === 5) op += 4;
                  }
                }
              } else {
                if      (mfw === 0) { while (mf[mp++] & 0x80); }
                else if (mfw === 1) mp += 8;
                else if (mfw === 2) { let ln=0,sh=0; while(true){const b=mf[mp++];ln|=(b&0x7F)<<sh;sh+=7;if(!(b&0x80))break;} mp+=ln; }
                else if (mfw === 5) mp += 4;
              }
            }
          } else {
            if      (fw === 0) { while (feedBuf[fp++] & 0x80); }
            else if (fw === 1) fp += 8;
            else if (fw === 2) { let ln=0,sh=0; while(true){const b=feedBuf[fp++];ln|=(b&0x7F)<<sh;sh+=7;if(!(b&0x80))break;} fp+=ln; }
            else if (fw === 5) fp += 4;
          }
        }

        if (ltp) {
          ticks[instrumentKey] = { ltp, cp, open: open||ltp, high: high||ltp, low: low||ltp, close: close||ltp, volume: vol };
        }
      } else {
        skipField(wt);
      }
    }
  } catch (e) {
    // Partial decode — return whatever we got
  }

  return ticks;
}

// ── Market hours check (IST) ─────────────────────────────────────────────────
function isMarketOpen() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const day  = ist.getUTCDay(); // 0=Sun, 6=Sat
  const h    = ist.getUTCHours();
  const m    = ist.getUTCMinutes();
  const mins = h * 60 + m;

  // NSE: Mon–Fri 09:15 – 15:30 IST
  if (day === 0 || day === 6) return false;
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

// ── MarketDataService ────────────────────────────────────────────────────────

class MarketDataService {
  constructor() {
    this.ws              = null;
    this.io              = null;
    this.subscribers     = [];
    this.latestTicks     = new Map();
    this.reconnectDelay  = 5000;
    this.isConnected     = false;
    this.mockInterval    = null;
    this.reconnectTimer  = null;
    this._stopped        = false;

    // Determined at start()
    this.hasToken = false;
  }

  setIO(io) { this.io = io; }

  subscribe(callback) { this.subscribers.push(callback); }

  start() {
    this._stopped = false;
    this.hasToken = !!(
      config.upstox.accessToken &&
      config.upstox.accessToken !== 'your_access_token_here' &&
      config.upstox.accessToken.length > 20
    );

    if (this.hasToken) {
      logger.info('MarketDataService: Access token found — connecting to Upstox LIVE feed');
      this._connectUpstox();
    } else {
      logger.warn('═══════════════════════════════════════════════════════════');
      logger.warn('  No UPSTOX_ACCESS_TOKEN set in .env');
      logger.warn('  Paper trading will use MOCK price data.');
      logger.warn('  To use REAL prices: add your token to backend/.env');
      logger.warn('  See README.md → "Getting an Upstox Access Token"');
      logger.warn('═══════════════════════════════════════════════════════════');
      this._startMockFeed();
    }
  }

  stop() {
    this._stopped = true;
    if (this.ws)            { this.ws.close(); this.ws = null; }
    if (this.mockInterval)  { clearInterval(this.mockInterval); this.mockInterval = null; }
    if (this.reconnectTimer){ clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  getLatestTick(symbol)  { return this.latestTicks.get(symbol); }

  getAllTicks() {
    const out = {};
    for (const [sym, tick] of this.latestTicks.entries()) out[sym] = tick;
    return out;
  }

  // ── Upstox WebSocket ──────────────────────────────────────────────────────

  async _connectUpstox() {
    if (this._stopped) return;

    try {
      logger.info('MarketDataService: Fetching WebSocket auth URL...');

      const resp = await axios.get(
        `${config.upstox.baseUrl}/feed/market-data-feed/authorize`,
        {
          headers: {
            Authorization: `Bearer ${config.upstox.accessToken}`,
            Accept:        'application/json',
          },
          timeout: 10000,
        }
      );

      const wsUrl = resp.data?.data?.authorizedRedirectUri;
      if (!wsUrl) throw new Error('Empty authorizedRedirectUri in response');

      logger.info('MarketDataService: Opening WebSocket connection...');
      this.ws = new WebSocket(wsUrl, {
        headers: { Authorization: `Bearer ${config.upstox.accessToken}` },
        handshakeTimeout: 10000,
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        logger.info('✅ Upstox WebSocket connected — live market feed active');
        this._subscribeSymbols();
      });

      this.ws.on('message', (data) => this._processMessage(data));

      this.ws.on('error', (err) => {
        logger.error('Upstox WS error', { message: err.message });
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        if (this._stopped) return;
        logger.warn(`Upstox WS closed (${code}). Reconnecting in ${this.reconnectDelay / 1000}s...`);
        this.reconnectTimer = setTimeout(() => this._connectUpstox(), this.reconnectDelay);
      });

    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      logger.error(`MarketDataService: Failed to connect — ${msg}`);

      if (err.response?.status === 401) {
        logger.error('❌ Access token is INVALID or EXPIRED.');
        logger.error('   Generate a new token: GET http://localhost:3001/auth/login');
        // Don't keep hammering with bad token — fall back to mock
        logger.warn('Falling back to MOCK feed. Fix your token to use real data.');
        this._startMockFeed();
        return;
      }

      if (!this._stopped) {
        this.reconnectTimer = setTimeout(() => this._connectUpstox(), this.reconnectDelay);
      }
    }
  }

  _subscribeSymbols() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      guid:   `algo-${Date.now()}`,
      method: 'sub',
      data: {
        mode:           'full',
        instrumentKeys: config.trading.symbols,
      },
    };

    this.ws.send(JSON.stringify(msg));
    logger.info('Subscribed to live feed', { symbols: config.trading.symbols });
  }

  _processMessage(rawData) {
    try {
      // Upstox sends binary protobuf
      const buf = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);

      // First try JSON (some env / older API versions send JSON)
      if (buf[0] === 0x7B) { // '{'
        const json = JSON.parse(buf.toString('utf8'));
        if (json.feeds) {
          this._processFeedsJSON(json.feeds);
          return;
        }
      }

      // Binary protobuf decode
      const decoded = decodeUpstoxProto(buf);
      for (const [instrumentKey, data] of Object.entries(decoded)) {
        this._emitTick(instrumentKey, data);
      }

    } catch (err) {
      // Ignore unparseable frames (heartbeats etc.)
    }
  }

  _processFeedsJSON(feeds) {
    for (const [instrumentKey, feedData] of Object.entries(feeds)) {
      const ltpc = feedData?.ff?.marketFF?.ltpc;
      if (!ltpc) continue;

      const ohlc = feedData?.ff?.marketFF?.marketOHLC?.ohlc || [];
      const day  = ohlc.find(o => o.interval === '1d') || ohlc[0] || {};

      this._emitTick(instrumentKey, {
        ltp:    ltpc.ltp,
        cp:     ltpc.cp || 0,
        open:   day.open  || ltpc.ltp,
        high:   day.high  || ltpc.ltp,
        low:    day.low   || ltpc.ltp,
        close:  day.close || ltpc.ltp,
        volume: day.vol   || 0,
      });
    }
  }

  _emitTick(instrumentKey, data) {
    const symbolName = config.trading.symbolNames[instrumentKey];
    if (!symbolName) return; // Only process symbols we care about

    const tick = {
      symbol:        symbolName,
      instrumentKey,
      ltp:           parseFloat((data.ltp || 0).toFixed(2)),
      open:          parseFloat((data.open || data.ltp).toFixed(2)),
      high:          parseFloat((data.high || data.ltp).toFixed(2)),
      low:           parseFloat((data.low  || data.ltp).toFixed(2)),
      close:         parseFloat((data.close|| data.ltp).toFixed(2)),
      volume:        data.volume || 0,
      prevClose:     parseFloat((data.cp   || 0).toFixed(2)),
      timestamp:     new Date().toISOString(),
      isLive:        true,
    };

    if (!tick.ltp) return;

    this._broadcastTick(tick);
  }

  // ── Mock Feed ─────────────────────────────────────────────────────────────
  // Only used when no access token is configured.
  // Uses realistic intraday random walk with drift.

  _startMockFeed() {
    const basePrice    = { NIFTY: 22500, BANKNIFTY: 48000 };
    const prices       = { ...basePrice };
    const sessionHigh  = { ...basePrice };
    const sessionLow   = { ...basePrice };
    const drift        = { NIFTY: 0, BANKNIFTY: 0 };
    let driftTick      = 0;

    logger.info('MarketDataService: 🎭 MOCK feed started (set UPSTOX_ACCESS_TOKEN for real data)');

    this.mockInterval = setInterval(() => {
      driftTick++;
      if (driftTick % 30 === 0) {
        drift.NIFTY     = (Math.random() - 0.48) * 3;
        drift.BANKNIFTY = (Math.random() - 0.48) * 8;
      }

      for (const symbol of ['NIFTY', 'BANKNIFTY']) {
        const vol    = symbol === 'NIFTY' ? 10 : 28;
        const noise  = (Math.random() + Math.random() - 1) * vol;
        prices[symbol] = parseFloat((prices[symbol] + noise + drift[symbol]).toFixed(2));

        // Clamp ±2% from base
        const cap = basePrice[symbol] * 0.02;
        prices[symbol] = Math.max(basePrice[symbol] - cap,
                           Math.min(basePrice[symbol] + cap, prices[symbol]));

        sessionHigh[symbol] = Math.max(sessionHigh[symbol], prices[symbol]);
        sessionLow[symbol]  = Math.min(sessionLow[symbol],  prices[symbol]);

        const tick = {
          symbol,
          instrumentKey: symbol === 'NIFTY' ? 'NSE_INDEX|Nifty 50' : 'NSE_INDEX|Nifty Bank',
          ltp:       prices[symbol],
          open:      basePrice[symbol],
          high:      sessionHigh[symbol],
          low:       sessionLow[symbol],
          close:     prices[symbol],
          prevClose: basePrice[symbol],
          volume:    Math.floor(Math.random() * 8000 + 2000),
          timestamp: new Date().toISOString(),
          isMock:    true,
          isLive:    false,
        };

        this._broadcastTick(tick);
      }
    }, 1000);
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────

  _broadcastTick(tick) {
    this.latestTicks.set(tick.symbol, tick);

    for (const cb of this.subscribers) {
      try { cb(tick); } catch (e) { logger.error('Subscriber error', { error: e.message }); }
    }

    if (this.io) this.io.emit('tick', tick);
  }
}

module.exports = new MarketDataService();
