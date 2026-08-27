const { downPaymentPercent } = require('../config');

/**
 * Money handling.
 *
 * All amounts are stored in the database as NUMERIC(10,2) and handled here
 * as numbers with exactly two decimal places. Values are truncated to two
 * decimals rather than rounded to whole pesos: the exact centavo amount is
 * deliberate, because it makes each payment easier for the admin to pick out
 * of a GCash or bank transaction list.
 */

/** Normalise a value to exactly two decimal places. */
function toAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Format for display, e.g. 499.8 -> "₱499.80" */
function formatPeso(value) {
  return `₱${toAmount(value).toFixed(2)}`;
}

/** Format without the symbol, e.g. 499.8 -> "499.80" — used for copy buttons. */
function formatPlain(value) {
  return toAmount(value).toFixed(2);
}

/**
 * Down payment: a fixed percentage of the subtotal, no rounding.
 * A ₱833.00 subtotal gives ₱499.80, and the customer is asked to pay
 * exactly that.
 */
function calcDownPayment(subtotal) {
  return toAmount(toAmount(subtotal) * (downPaymentPercent / 100));
}

/**
 * Balance owed at the second payment: whatever is left of the subtotal
 * after the down payment, plus the shipping fee.
 *
 * Shipping is nullable because it depends on weight and destination and is
 * only known when the item is ready to ship, not at checkout.
 */
function calcBalance(subtotal, downPayment, shippingFee) {
  const remaining = toAmount(subtotal) - toAmount(downPayment);
  return toAmount(remaining + toAmount(shippingFee || 0));
}

/** Sum order line items into a subtotal. */
function calcSubtotal(items) {
  return toAmount(
    items.reduce((sum, item) => sum + toAmount(item.unit_price) * item.quantity, 0)
  );
}

module.exports = {
  toAmount,
  formatPeso,
  formatPlain,
  calcDownPayment,
  calcBalance,
  calcSubtotal,
};
