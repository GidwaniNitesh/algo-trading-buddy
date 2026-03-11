// backend/strategies/rsiStrategy.js

/**
 * RSI Strategy
 * BUY: RSI < oversold threshold (default 30)
 * SELL: RSI > overbought threshold (default 70)
 */

class RSIStrategy {
  constructor() {
    this.name = 'RSI';
    this.config = {};
    this.prices = [];
    this.prevRSI = null;
    this.inPosition = false;
  }

  init(config) {
    this.config = {
      period: config.period || 14,
      oversold: config.oversold || 30,
      overbought: config.overbought || 70,
      symbol: config.symbol || 'BANKNIFTY',
      qty: config.qty || 15,
      ...config,
    };
    this.prices = [];
    this.prevRSI = null;
    this.inPosition = false;
    return this;
  }

  onTick(tick) {
    if (tick.symbol !== this.config.symbol) return null;

    this.prices.push(tick.ltp);

    const needed = this.config.period * 3;
    if (this.prices.length > needed) {
      this.prices = this.prices.slice(-needed);
    }

    if (this.prices.length < this.config.period + 1) return null;

    const rsi = this._calcRSI(this.prices, this.config.period);
    let signal = null;

    if (this.prevRSI !== null) {
      // Crossed into oversold (buy signal)
      if (this.prevRSI >= this.config.oversold && rsi < this.config.oversold && !this.inPosition) {
        signal = {
          strategy: this.name,
          signal: 'BUY',
          symbol: this.config.symbol,
          qty: this.config.qty,
          type: 'MARKET',
          meta: { rsi: rsi.toFixed(2) },
        };
        this.inPosition = true;
      }

      // Crossed into overbought (sell signal)
      if (this.prevRSI <= this.config.overbought && rsi > this.config.overbought && this.inPosition) {
        signal = {
          strategy: this.name,
          signal: 'SELL',
          symbol: this.config.symbol,
          qty: this.config.qty,
          type: 'MARKET',
          meta: { rsi: rsi.toFixed(2) },
        };
        this.inPosition = false;
      }
    }

    this.prevRSI = rsi;
    return signal;
  }

  onCandle(candle) {
    return null;
  }

  getState() {
    return {
      name: this.name,
      symbol: this.config.symbol,
      period: this.config.period,
      oversold: this.config.oversold,
      overbought: this.config.overbought,
      rsi: this.prevRSI?.toFixed(2),
      inPosition: this.inPosition,
    };
  }

  _calcRSI(prices, period) {
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const recent = changes.slice(-period);
    const gains = recent.filter(c => c > 0);
    const losses = recent.filter(c => c < 0).map(Math.abs);

    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }
}

module.exports = RSIStrategy;
