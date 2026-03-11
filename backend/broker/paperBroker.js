// backend/broker/paperBroker.js
const { v4: uuidv4 } = require('uuid');
const BrokerInterface = require('./brokerInterface');
const db = require('../database/db');
const logger = require('../logs/logger');
const config = require('../config/config');

class PaperBroker extends BrokerInterface {
  constructor() {
    super();
    this.capital = config.paper.initialCapital;
    this.usedMargin = 0;
    this.positions = new Map(); // symbol -> { qty, avgPrice }
    this.orders = [];
    this.currentPrices = new Map(); // symbol -> ltp
    this.tradingMode = 'PAPER_TRADING';
  }

  getName() {
    return 'PaperBroker';
  }

  isPaper() {
    return true;
  }

  /**
   * Update current market price for a symbol.
   * Called by MarketDataService on every tick.
   */
  updatePrice(symbol, price) {
    this.currentPrices.set(symbol, price);
    this._updatePositionPnL(symbol, price);
  }

  /**
   * Place a simulated order using current market price.
   */
  async placeOrder(order) {
    const { symbol, side, type, qty, price, strategy } = order;

    const ltp = this.currentPrices.get(symbol);
    if (!ltp && type === 'MARKET') {
      return { success: false, message: `No market price available for ${symbol}` };
    }

    const fillPrice = type === 'MARKET' ? ltp : (price || ltp);
    const orderId = uuidv4();
    const totalValue = fillPrice * qty;

    // Check available capital for BUY
    if (side === 'BUY') {
      const available = this.capital - this.usedMargin;
      if (totalValue > available) {
        logger.warn(`Paper: Insufficient capital. Need ₹${totalValue.toFixed(2)}, Available ₹${available.toFixed(2)}`);
        return { success: false, message: 'Insufficient capital' };
      }
    }

    // Create order record
    const orderRecord = {
      id: orderId,
      broker_order_id: `PAPER-${orderId.slice(0, 8)}`,
      symbol,
      side,
      type,
      qty,
      price: fillPrice,
      status: 'COMPLETE',
      strategy: strategy || null,
      trading_mode: this.tradingMode,
    };

    db.orders.insert(orderRecord);
    this.orders.push(orderRecord);

    // Execute fill
    this._fillOrder(orderRecord, fillPrice);

    logger.trade(`Paper order filled: ${side} ${qty} ${symbol} @ ₹${fillPrice.toFixed(2)}`, {
      orderId,
      strategy,
    });

    return {
      success: true,
      orderId,
      fillPrice,
      message: `Paper order filled: ${side} ${qty} ${symbol} @ ₹${fillPrice}`,
    };
  }

  async cancelOrder(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found' };

    order.status = 'CANCELLED';
    db.orders.update(orderId, { status: 'CANCELLED' });
    return { success: true, message: 'Order cancelled' };
  }

  async getPositions() {
    const positions = [];
    for (const [symbol, pos] of this.positions.entries()) {
      const ltp = this.currentPrices.get(symbol) || pos.avgPrice;
      const pnl = (ltp - pos.avgPrice) * pos.qty;
      positions.push({
        symbol,
        qty: pos.qty,
        avgPrice: pos.avgPrice,
        ltp,
        pnl: parseFloat(pnl.toFixed(2)),
        tradingMode: this.tradingMode,
      });
    }
    return positions;
  }

  async getOrders() {
    return this.orders.slice(-100).reverse();
  }

  async getAccountInfo() {
    let totalPnl = 0;
    for (const [symbol, pos] of this.positions.entries()) {
      const ltp = this.currentPrices.get(symbol) || pos.avgPrice;
      totalPnl += (ltp - pos.avgPrice) * pos.qty;
    }

    return {
      capital: this.capital,
      usedMargin: this.usedMargin,
      availableMargin: this.capital - this.usedMargin,
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      tradingMode: this.tradingMode,
    };
  }

  // --- Private helpers ---

  _fillOrder(order, fillPrice) {
    const { symbol, side, qty } = order;
    const totalValue = fillPrice * qty;

    let existingPos = this.positions.get(symbol) || { qty: 0, avgPrice: 0 };

    if (side === 'BUY') {
      const newQty = existingPos.qty + qty;
      const newAvgPrice =
        existingPos.qty === 0
          ? fillPrice
          : (existingPos.avgPrice * existingPos.qty + fillPrice * qty) / newQty;

      this.positions.set(symbol, { qty: newQty, avgPrice: newAvgPrice });
      this.usedMargin += totalValue;

    } else if (side === 'SELL') {
      const newQty = existingPos.qty - qty;

      let pnl = 0;
      if (existingPos.qty > 0) {
        pnl = (fillPrice - existingPos.avgPrice) * Math.min(qty, existingPos.qty);
        this.capital += pnl;
        this.usedMargin -= existingPos.avgPrice * Math.min(qty, existingPos.qty);
      }

      if (newQty <= 0) {
        this.positions.delete(symbol);
        db.positions.deleteBySymbol(symbol);
      } else {
        this.positions.set(symbol, { qty: newQty, avgPrice: existingPos.avgPrice });
      }

      // Record trade with PnL
      db.trades.insert({
        id: uuidv4(),
        order_id: order.id,
        symbol,
        side,
        qty,
        price: fillPrice,
        pnl: parseFloat(pnl.toFixed(2)),
        strategy: order.strategy,
        trading_mode: this.tradingMode,
      });
    }

    // Upsert DB position
    if (this.positions.has(symbol)) {
      const pos = this.positions.get(symbol);
      db.positions.upsert({
        id: uuidv4(),
        symbol,
        qty: pos.qty,
        avg_price: pos.avgPrice,
        ltp: fillPrice,
        pnl: 0,
        trading_mode: this.tradingMode,
      });
    }
  }

  _updatePositionPnL(symbol, ltp) {
    const pos = this.positions.get(symbol);
    if (!pos) return;

    const pnl = (ltp - pos.avgPrice) * pos.qty;
    db.positions.upsert({
      id: uuidv4(),
      symbol,
      qty: pos.qty,
      avg_price: pos.avgPrice,
      ltp,
      pnl: parseFloat(pnl.toFixed(2)),
      trading_mode: this.tradingMode,
    });
  }
}

module.exports = PaperBroker;
