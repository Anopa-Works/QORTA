/**
 * QORTA Backend - Constants Configuration
 * Defines system-wide constants for order statuses, types, and settings
 */

const ORDER_STATUS = {
  NEW: 'NEW',
  PREP: 'PREP',
  READY: 'READY',
  COMPLETE: 'COMPLETE'
};

const ORDER_TYPE = {
  DINE_IN: 'DINE_IN',
  TAKEOUT: 'TAKEOUT',
  DELIVERY: 'DELIVERY'
};

const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED'
};

const DEFAULT_SETTINGS = {
  taxRate: 0.08,  // 8% as shown in screenshots
  currency: 'USD',
  timezone: 'UTC'
};

// Valid status transitions
const STATUS_TRANSITIONS = {
  [ORDER_STATUS.NEW]: [ORDER_STATUS.PREP],
  [ORDER_STATUS.PREP]: [ORDER_STATUS.READY],
  [ORDER_STATUS.READY]: [ORDER_STATUS.COMPLETE],
  [ORDER_STATUS.COMPLETE]: []
};

module.exports = {
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_STATUS,
  DEFAULT_SETTINGS,
  STATUS_TRANSITIONS
};
