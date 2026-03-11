// backend/engine/strategyEngine.js
const logger = require('../logs/logger');
const config = require('../config/config');

const EMAStrategy = require('../strategies/emaStrategy');
const RSIStrategy = require('../strategies/rsiStrategy');
const VWAPStrategy = require('../strategies/vwapStrategy');

class StrategyEngine {
  constructor() {
    this.strategies = [];
    this.orderManager = null;
    this.io = null;
    this.isRunning = false;
    this.signalCount = 0;
  }

  setOrderManager(orderManager) {
    this.orderManager = orderManager;
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Load and initialize all enabled strategies.
   */
  loadStrategies() {
    this.strategies = [];

    if (config.strategies.ema.enabled) {
      const ema = new EMAStrategy().init(config.strategies.ema);
      this.strategies.push(ema);
      logger.strategy('Loaded EMAStrategy', config.strategies.ema);
    }

    if (config.strategies.rsi.enabled) {
      const rsi = new RSIStrategy().init(config.strategies.rsi);
      this.strategies.push(rsi);
      logger.strategy('Loaded RSIStrategy', config.strategies.rsi);
    }

    if (config.strategies.vwap.enabled) {
      const vwap = new VWAPStrategy().init(config.strategies.vwap);
      this.strategies.push(vwap);
      logger.strategy('Loaded VWAPStrategy', config.strategies.vwap);
    }

    logger.info(`StrategyEngine: Loaded ${this.strategies.length} strategies`);
  }

  /**
   * Add a strategy dynamically.
   */
  addStrategy(strategyInstance) {
    this.strategies.push(strategyInstance);
    logger.strategy(`Dynamically added strategy: ${strategyInstance.name}`);
  }

  /**
   * Remove a strategy by name.
   */
  removeStrategy(name) {
    const before = this.strategies.length;
    this.strategies = this.strategies.filter(s => s.name !== name);
    const removed = before - this.strategies.length;
    logger.strategy(`Removed strategy: ${name} (${removed} removed)`);
  }

  start() {
    this.isRunning = true;
    logger.info('StrategyEngine: Started');
  }

  stop() {
    this.isRunning = false;
    logger.info('StrategyEngine: Stopped');
  }

  /**
   * Process an incoming tick from MarketDataService.
   * Each strategy gets the tick independently.
   */
  onTick(tick) {
    if (!this.isRunning) return;

    for (const strategy of this.strategies) {
      try {
        const signal = strategy.onTick(tick);
        if (signal) {
          this._handleSignal(signal);
        }
      } catch (err) {
        logger.error(`Strategy ${strategy.name} error on tick`, { error: err.message });
      }
    }

    // Emit strategy states to frontend
    if (this.io) {
      this.io.emit('strategyStates', this.getStates());
    }
  }

  onCandle(candle) {
    if (!this.isRunning) return;

    for (const strategy of this.strategies) {
      try {
        const signal = strategy.onCandle(candle);
        if (signal) {
          this._handleSignal(signal);
        }
      } catch (err) {
        logger.error(`Strategy ${strategy.name} error on candle`, { error: err.message });
      }
    }
  }

  _handleSignal(signal) {
    this.signalCount++;
    logger.strategy(`Signal #${this.signalCount}: ${signal.signal} ${signal.qty} ${signal.symbol}`, signal);

    if (this.io) {
      this.io.emit('signal', signal);
    }

    if (this.orderManager) {
      this.orderManager.handleSignal(signal);
    }
  }

  getStates() {
    return this.strategies.map(s => {
      try {
        return s.getState ? s.getState() : { name: s.name };
      } catch {
        return { name: s.name };
      }
    });
  }

  getInfo() {
    return {
      isRunning: this.isRunning,
      strategyCount: this.strategies.length,
      signalCount: this.signalCount,
      strategies: this.getStates(),
    };
  }
}

module.exports = new StrategyEngine();
