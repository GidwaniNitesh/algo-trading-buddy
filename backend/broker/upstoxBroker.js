// backend/broker/upstoxBroker.js
const axios = require('axios');
const BrokerInterface = require('./brokerInterface');
const logger = require('../logs/logger');
const config = require('../config/config');

class UpstoxBroker extends BrokerInterface {
  constructor() {
    super();
    this.baseUrl = config.upstox.baseUrl;
    this.accessToken = config.upstox.accessToken;
    this.tradingMode = 'REAL_TRADING';
  }

  getName() {
    return 'UpstoxBroker';
  }

  isPaper() {
    return false;
  }

  _headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async _get(endpoint) {
    try {
      const resp = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: this._headers(),
      });
      return resp.data;
    } catch (err) {
      logger.error(`Upstox GET ${endpoint} failed`, { error: err.message });
      throw err;
    }
  }

  async _post(endpoint, data) {
    try {
      const resp = await axios.post(`${this.baseUrl}${endpoint}`, data, {
        headers: this._headers(),
      });
      return resp.data;
    } catch (err) {
      logger.error(`Upstox POST ${endpoint} failed`, { error: err.message, data });
      throw err;
    }
  }

  async _delete(endpoint) {
    try {
      const resp = await axios.delete(`${this.baseUrl}${endpoint}`, {
        headers: this._headers(),
      });
      return resp.data;
    } catch (err) {
      logger.error(`Upstox DELETE ${endpoint} failed`, { error: err.message });
      throw err;
    }
  }

  /**
   * Map internal symbol to Upstox instrument key.
   */
  _mapSymbol(symbol) {
    const symbolMap = {
      NIFTY: 'NSE_INDEX|Nifty 50',
      BANKNIFTY: 'NSE_INDEX|Nifty Bank',
    };
    return symbolMap[symbol] || symbol;
  }

  async placeOrder(order) {
    const { symbol, side, type, qty, price, strategy } = order;

    const payload = {
      quantity: qty,
      product: 'I', // Intraday
      validity: 'DAY',
      price: type === 'LIMIT' ? price : 0,
      tag: strategy || 'algo-trade',
      instrument_token: this._mapSymbol(symbol),
      order_type: type === 'MARKET' ? 'MARKET' : 'LIMIT',
      transaction_type: side,
      disclosed_quantity: 0,
      trigger_price: 0,
      is_amo: false,
    };

    try {
      const response = await this._post('/order/place', payload);
      logger.trade(`Upstox order placed: ${side} ${qty} ${symbol}`, {
        orderId: response.data?.order_id,
        strategy,
      });

      return {
        success: true,
        orderId: response.data?.order_id,
        message: response.status,
      };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || err.message,
      };
    }
  }

  async cancelOrder(orderId) {
    try {
      await this._delete(`/order/cancel?order_id=${orderId}`);
      return { success: true, message: 'Order cancelled' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async getPositions() {
    try {
      const resp = await this._get('/portfolio/short-term-positions');
      return (resp.data || []).map(pos => ({
        symbol: pos.tradingsymbol,
        qty: pos.quantity,
        avgPrice: pos.average_price,
        ltp: pos.last_price,
        pnl: pos.pnl,
        tradingMode: this.tradingMode,
      }));
    } catch (err) {
      logger.error('Failed to get Upstox positions', { error: err.message });
      return [];
    }
  }

  async getOrders() {
    try {
      const resp = await this._get('/order/retrieve-all');
      return (resp.data || []).map(ord => ({
        id: ord.order_id,
        symbol: ord.tradingsymbol,
        side: ord.transaction_type,
        type: ord.order_type,
        qty: ord.quantity,
        price: ord.price,
        status: ord.status,
        tradingMode: this.tradingMode,
      }));
    } catch (err) {
      logger.error('Failed to get Upstox orders', { error: err.message });
      return [];
    }
  }

  async getAccountInfo() {
    try {
      const resp = await this._get('/user/get-funds-and-margin?segment=SEC');
      const data = resp.data?.equity || {};
      return {
        capital: data.total_collateral || 0,
        usedMargin: data.utilized_amount || 0,
        availableMargin: data.available_margin || 0,
        tradingMode: this.tradingMode,
      };
    } catch (err) {
      logger.error('Failed to get Upstox account info', { error: err.message });
      return {};
    }
  }
}

module.exports = UpstoxBroker;
