// backend/database/db.js
// Uses sql.js — pure JavaScript SQLite, NO native compilation required.
// Works on any platform without node-gyp or build tools.

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db = null;

function persistDB() {
  if (!_db) return;
  try {
    const data = _db.export();
    fs.writeFileSync(config.database.path, Buffer.from(data));
  } catch (e) { /* ignore */ }
}

function run(sql, params = []) {
  getDB().run(sql, params);
  return true;
}

function all(sql, params = []) {
  const stmt = getDB().prepare(sql);
  const rows = [];
  stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0];
}

function getDB() {
  if (!_db) throw new Error('DB not initialized yet — await initDB() first');
  return _db;
}

async function initDB() {
  const SQL = await initSqlJs();
  let fileBuffer = null;
  if (fs.existsSync(config.database.path)) {
    fileBuffer = fs.readFileSync(config.database.path);
  }
  _db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  _db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      broker_order_id TEXT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      type TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price REAL,
      status TEXT DEFAULT 'PENDING',
      strategy TEXT,
      trading_mode TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      qty INTEGER NOT NULL DEFAULT 0,
      avg_price REAL NOT NULL DEFAULT 0,
      ltp REAL DEFAULT 0,
      pnl REAL DEFAULT 0,
      trading_mode TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      pnl REAL DEFAULT 0,
      strategy TEXT,
      trading_mode TEXT,
      executed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS candles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL DEFAULT 0,
      timestamp TEXT NOT NULL
    );
  `);

  setInterval(persistDB, 10000);
  process.on('exit', persistDB);
  process.on('SIGINT', () => { persistDB(); process.exit(); });

  console.log('[DB] sql.js initialized successfully');
  return _db;
}

const orders = {
  insert(o) {
    run(
      `INSERT OR IGNORE INTO orders (id,broker_order_id,symbol,side,type,qty,price,status,strategy,trading_mode)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [o.id, o.broker_order_id||null, o.symbol, o.side, o.type,
       o.qty, o.price||null, o.status||'PENDING', o.strategy||null, o.trading_mode||null]
    );
  },
  update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const sets = keys.map(k => `${k}=?`).join(',');
    run(`UPDATE orders SET ${sets}, updated_at=datetime('now') WHERE id=?`, [...keys.map(k=>fields[k]), id]);
  },
  findAll(mode) {
    return all('SELECT * FROM orders WHERE trading_mode=? ORDER BY created_at DESC LIMIT 100', [mode]);
  },
  findById(id) {
    return get('SELECT * FROM orders WHERE id=?', [id]);
  },
};

const positions = {
  upsert(p) {
    run(
      `INSERT INTO positions (id,symbol,qty,avg_price,ltp,pnl,trading_mode)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(symbol) DO UPDATE SET
         qty=excluded.qty, avg_price=excluded.avg_price,
         ltp=excluded.ltp, pnl=excluded.pnl, updated_at=datetime('now')`,
      [p.id, p.symbol, p.qty, p.avg_price, p.ltp, p.pnl, p.trading_mode||null]
    );
  },
  findAll(mode) {
    return all('SELECT * FROM positions WHERE trading_mode=? AND qty!=0', [mode]);
  },
  findBySymbol(symbol) {
    return get('SELECT * FROM positions WHERE symbol=?', [symbol]);
  },
  deleteBySymbol(symbol) {
    run('DELETE FROM positions WHERE symbol=?', [symbol]);
  },
};

const trades = {
  insert(t) {
    run(
      `INSERT OR IGNORE INTO trades (id,order_id,symbol,side,qty,price,pnl,strategy,trading_mode)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [t.id, t.order_id||null, t.symbol, t.side, t.qty,
       t.price, t.pnl||0, t.strategy||null, t.trading_mode||null]
    );
  },
  findAll(mode) {
    return all('SELECT * FROM trades WHERE trading_mode=? ORDER BY executed_at DESC LIMIT 100', [mode]);
  },
};

const logs = {
  insert(log) {
    run('INSERT INTO logs (level,message,meta) VALUES (?,?,?)',
        [log.level, log.message, JSON.stringify(log.meta||{})]);
  },
  findRecent(limit = 50) {
    return all('SELECT * FROM logs ORDER BY created_at DESC LIMIT ?', [limit]);
  },
};

const candles = {
  insert(c) {
    run(
      `INSERT INTO candles (symbol,open,high,low,close,volume,timestamp) VALUES (?,?,?,?,?,?,?)`,
      [c.symbol, c.open, c.high, c.low, c.close, c.volume||0, c.timestamp]
    );
  },
  findBySymbol(symbol, limit = 200) {
    return all('SELECT * FROM candles WHERE symbol=? ORDER BY timestamp DESC LIMIT ?', [symbol, limit]);
  },
};

module.exports = { initDB, orders, positions, trades, logs, candles };
