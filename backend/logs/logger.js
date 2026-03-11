// backend/logs/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure log directory exists
const logDir = config.logging.dir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'trades.log'),
      level: 'info',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
});

// Socket.IO emitter — set externally after server init
let _io = null;

logger.setIO = (io) => {
  _io = io;
};

// Wrap logger methods to also emit to frontend
const originalInfo = logger.info.bind(logger);
const originalError = logger.error.bind(logger);
const originalWarn = logger.warn.bind(logger);

logger.info = (message, meta = {}) => {
  originalInfo(message, meta);
  if (_io) {
    _io.emit('log', { level: 'info', message, meta, timestamp: new Date().toISOString() });
  }
};

logger.error = (message, meta = {}) => {
  originalError(message, meta);
  if (_io) {
    _io.emit('log', { level: 'error', message, meta, timestamp: new Date().toISOString() });
  }
};

logger.warn = (message, meta = {}) => {
  originalWarn(message, meta);
  if (_io) {
    _io.emit('log', { level: 'warn', message, meta, timestamp: new Date().toISOString() });
  }
};

logger.trade = (message, meta = {}) => {
  logger.info(`[TRADE] ${message}`, meta);
};

logger.strategy = (message, meta = {}) => {
  logger.info(`[STRATEGY] ${message}`, meta);
};

module.exports = logger;
