// backend/broker/brokerInterface.js

/**
 * Abstract Broker Interface
 * All broker implementations must implement these methods.
 */
class BrokerInterface {
  /**
   * Place an order with the broker.
   * @param {Object} order - { symbol, side, type, qty, price? }
   * @returns {Promise<Object>} - { success, orderId, message }
   */
  async placeOrder(order) {
    throw new Error('placeOrder() must be implemented by broker');
  }

  /**
   * Cancel an existing order.
   * @param {string} orderId
   * @returns {Promise<Object>} - { success, message }
   */
  async cancelOrder(orderId) {
    throw new Error('cancelOrder() must be implemented by broker');
  }

  /**
   * Get all open/recent positions.
   * @returns {Promise<Array>}
   */
  async getPositions() {
    throw new Error('getPositions() must be implemented by broker');
  }

  /**
   * Get all recent orders.
   * @returns {Promise<Array>}
   */
  async getOrders() {
    throw new Error('getOrders() must be implemented by broker');
  }

  /**
   * Get account balance / margin info.
   * @returns {Promise<Object>}
   */
  async getAccountInfo() {
    throw new Error('getAccountInfo() must be implemented by broker');
  }

  /**
   * Get broker name identifier.
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented by broker');
  }

  /**
   * Check if broker is in paper trading mode.
   * @returns {boolean}
   */
  isPaper() {
    return false;
  }
}

module.exports = BrokerInterface;
