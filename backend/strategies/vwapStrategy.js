// backend/strategies/vwapStrategy.js

/**
 * VWAP Strategy
 * BUY: Price crosses above VWAP
 * SELL: Price crosses below VWAP
 */

class VWAPStrategy {
  constructor() {
    this.name = 'VWAP';
    this.config = {};
    this.ticks = [];
    this.vwap = null;
    this.prevLtp = null;
    this.inPosition = false;
    this.sessionStart = null;
  }

  init(config) {
    this.config = {
      symbol: config.symbol || 'NIFTY',
      qty: config.qty || 50,
      ...config,
    };
    this._resetSession();
    return this;
  }

  onTick(tick) {
    if (tick.symbol !== this.config.symbol) return null;

    const now = new Date();

    // Reset VWAP at 9:15 AM IST (market open)
    const hours = now.getHours();
    const mins = now.getMinutes();
    if (hours === 9 && mins === 15 && (!this.sessionStart || this.sessionStart.getDate() !== now.getDate())) {
      this._resetSession();
    }

    const ltp = tick.ltp;
    const vol = tick.volume || 1;

    this.ticks.push({ price: ltp, volume: vol });

    // Keep last 1000 ticks for VWAP calculation
    if (this.ticks.length > 1000) {
      this.ticks = this.ticks.slice(-1000);
    }

    const totalPV = this.ticks.reduce((acc, t) => acc + t.price * t.volume, 0);
    const totalVol = this.ticks.reduce((acc, t) => acc + t.volume, 0);
    const newVWAP = totalVol > 0 ? totalPV / totalVol : ltp;

    let signal = null;

    if (this.prevLtp !== null && this.vwap !== null) {
      const crossedAbove = this.prevLtp <= this.vwap && ltp > newVWAP;
      const crossedBelow = this.prevLtp >= this.vwap && ltp < newVWAP;

      if (crossedAbove && !this.inPosition) {
        signal = {
          strategy: this.name,
          signal: 'BUY',
          symbol: this.config.symbol,
          qty: this.config.qty,
          type: 'MARKET',
          meta: { vwap: newVWAP.toFixed(2), ltp: ltp.toFixed(2) },
        };
        this.inPosition = true;
      } else if (crossedBelow && this.inPosition) {
        signal = {
          strategy: this.name,
          signal: 'SELL',
          symbol: this.config.symbol,
          qty: this.config.qty,
          type: 'MARKET',
          meta: { vwap: newVWAP.toFixed(2), ltp: ltp.toFixed(2) },
        };
        this.inPosition = false;
      }
    }

    this.vwap = newVWAP;
    this.prevLtp = ltp;

    return signal;
  }

  onCandle(candle) {
    return null;
  }

  getState() {
    return {
      name: this.name,
      symbol: this.config.symbol,
      vwap: this.vwap?.toFixed(2),
      ltp: this.prevLtp,
      inPosition: this.inPosition,
    };
  }

  _resetSession() {
    this.ticks = [];
    this.vwap = null;
    this.prevLtp = null;
    this.sessionStart = new Date();
  }
}

module.exports = VWAPStrategy;
