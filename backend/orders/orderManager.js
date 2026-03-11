// backend/orders/orderManager.js
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const logger = require('../logs/logger');
const config = require('../config/config');

class OrderManager {
  constructor() {
    this.broker = null;
    this.io = null;
    this.pendingSignals = new Map(); // Throttle same signal
    this.throttleMs = 5000; // Don't re-signal same strategy+symbol within 5s
  }

  setBroker(broker) {
    this.broker = broker;
    logger.info(`OrderManager: Using broker ${broker.getName()} (paper=${broker.isPaper()})`);
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Handle a signal from the strategy engine.
   */
  async handleSignal(signal) {
    const { strategy, signal: side, symbol, qty, type, price } = signal;

    // Throttle duplicate signals
    const throttleKey = `${strategy}-${symbol}-${side}`;
    const lastSignalTime = this.pendingSignals.get(throttleKey);
    if (lastSignalTime && Date.now() - lastSignalTime < this.throttleMs) {
      logger.info(`OrderManager: Throttled duplicate signal ${throttleKey}`);
      return;
    }
    this.pendingSignals.set(throttleKey, Date.now());

    // Validate
    const validation = this._validate(signal);
    if (!validation.valid) {
      logger.warn(`OrderManager: Signal validation failed — ${validation.reason}`, signal);
      return;
    }

    const order = {
      symbol,
      side,
      type: type || 'MARKET',
      qty,
      price: price || null,
      strategy,
    };

    logger.info(`OrderManager: Processing ${side} ${qty} ${symbol} from ${strategy}`);

    try {
      const result = await this.broker.placeOrder(order);

      const orderRecord = {
        id: uuidv4(),
        broker_order_id: result.orderId || null,
        symbol,
        side,
        type: order.type,
        qty,
        price: result.fillPrice || price || null,
        status: result.success ? 'COMPLETE' : 'FAILED',
        strategy,
        trading_mode: config.trading.mode,
      };

      db.orders.insert(orderRecord);

      if (result.success) {
        logger.trade(`Order executed: ${side} ${qty} ${symbol} via ${strategy}`, {
          orderId: result.orderId,
          fillPrice: result.fillPrice,
        });
      } else {
        logger.error(`Order failed: ${result.message}`, { order });
      }

      // Broadcast to frontend
      this._broadcast();

    } catch (err) {
      logger.error('OrderManager: Unexpected error placing order', { error: err.message, signal });
    }
  }

  /**
   * Manually place an order from the API.
   */
  async placeManualOrder(orderParams) {
    const result = await this.broker.placeOrder({
      ...orderParams,
      strategy: 'MANUAL',
    });

    if (result.success) {
      const record = {
        id: uuidv4(),
        broker_order_id: result.orderId || null,
        symbol: orderParams.symbol,
        side: orderParams.side,
        type: orderParams.type || 'MARKET',
        qty: orderParams.qty,
        price: result.fillPrice || orderParams.price || null,
        status: 'COMPLETE',
        strategy: 'MANUAL',
        trading_mode: config.trading.mode,
      };
      db.orders.insert(record);
      this._broadcast();
    }

    return result;
  }

  async cancelOrder(orderId) {
    const result = await this.broker.cancelOrder(orderId);
    if (result.success) {
      db.orders.update(orderId, { status: 'CANCELLED' });
      this._broadcast();
    }
    return result;
  }

  async _broadcast() {
    if (!this.io) return;
    const positions = await this.broker.getPositions();
    const orders = db.orders.findAll(config.trading.mode);
    const accountInfo = await this.broker.getAccountInfo();

    this.io.emit('positions', positions);
    this.io.emit('orders', orders);
    this.io.emit('accountInfo', accountInfo);
  }

  _validate(signal) {
    if (!signal.symbol) return { valid: false, reason: 'Missing symbol' };
    if (!signal.signal) return { valid: false, reason: 'Missing signal direction' };
    if (!signal.qty || signal.qty <= 0) return { valid: false, reason: 'Invalid qty' };
    if (!['BUY', 'SELL'].includes(signal.signal)) return { valid: false, reason: 'Invalid signal direction' };
    return { valid: true };
  }
}

module.exports = new OrderManager();
