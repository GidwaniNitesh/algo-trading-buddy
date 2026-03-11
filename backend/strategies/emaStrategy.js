// backend/strategies/emaStrategy.js

/**
 * EMA Crossover Strategy
 * BUY: Fast EMA crosses above Slow EMA
 * SELL: Fast EMA crosses below Slow EMA
 */

class EMAStrategy {
  constructor() {
    this.name = 'EMA';
    this.config = {};
    this.prices = [];
    this.prevFastEMA = null;
    this.prevSlowEMA = null;
    this.inPosition = false;
    this.positionSide = null;
  }

  init(config) {
    this.config = {
      fastPeriod: config.fastPeriod || 9,
      slowPeriod: config.slowPeriod || 21,
      symbol: config.symbol || 'NIFTY',
      qty: config.qty || 50,
      ...config,
    };
    this.prices = [];
    this.prevFastEMA = null;
    this.prevSlowEMA = null;
    this.inPosition = false;
    return this;
  }

  onTick(tick) {
    if (tick.symbol !== this.config.symbol) return null;

    this.prices.push(tick.ltp);

    // Keep only what's needed
    const needed = this.config.slowPeriod * 3;
    if (this.prices.length > needed) {
      this.prices = this.prices.slice(-needed);
    }

    if (this.prices.length < this.config.slowPeriod) return null;

    const fastEMA = this._calcEMA(this.prices, this.config.fastPeriod);
    const slowEMA = this._calcEMA(this.prices, this.config.slowPeriod);

    let signal = null;

    if (this.prevFastEMA !== null && this.prevSlowEMA !== null) {
      const crossedAbove = this.prevFastEMA <= this.prevSlowEMA && fastEMA > slowEMA;
      const crossedBelow = this.prevFastEMA >= this.prevSlowEMA && fastEMA < slowEMA;

      if (crossedAbove && !this.inPosition) {
        signal = {
          strategy: this.name,
          signal: 'BUY',
          symbol: this.config.symbol,
          qty: this.config.qty,
          type: 'MARKET',
          meta: { fastEMA: fastEMA.toFixed(2), slowEMA: slowEMA.toFixed(2) },
        };
        this.inPosition = true;
        this.positionSide = 'BUY';

      } else if (crossedBelow && this.inPosition && this.positionSide === 'BUY') {
        signal = {
          strategy: this.name,
          signal: 'SELL',
          symbol: this.config.symbol,
          qty: this.config.qty,
          type: 'MARKET',
          meta: { fastEMA: fastEMA.toFixed(2), slowEMA: slowEMA.toFixed(2) },
        };
        this.inPosition = false;
        this.positionSide = null;
      }
    }

    this.prevFastEMA = fastEMA;
    this.prevSlowEMA = slowEMA;

    return signal;
  }

  onCandle(candle) {
    // EMA works on ticks in this implementation
    return null;
  }

  getState() {
    return {
      name: this.name,
      symbol: this.config.symbol,
      fastPeriod: this.config.fastPeriod,
      slowPeriod: this.config.slowPeriod,
      priceCount: this.prices.length,
      fastEMA: this.prevFastEMA?.toFixed(2),
      slowEMA: this.prevSlowEMA?.toFixed(2),
      inPosition: this.inPosition,
    };
  }

  _calcEMA(prices, period) {
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }
}

module.exports = EMAStrategy;
