const razor = require("../config/razorpay");

/**
 * Refund one PAID payment at its gateway. Sandbox payments have nothing to reverse.
 * Throws (with statusCode 502) if Razorpay refuses, so callers can leave the data untouched.
 */
async function refundAtGateway(payment) {
  if (payment.gateway !== "razorpay") return { refundId: undefined };
  const rz = razor.getInstance();
  if (!rz) {
    const e = new Error("This payment was taken through Razorpay, but Razorpay keys are not configured, so it cannot be refunded here.");
    e.statusCode = 502; throw e;
  }
  try {
    const r = await rz.payments.refund(payment.gatewayPaymentId, { amount: Math.round(payment.amount * 100), notes: { paymentId: payment.paymentId } });
    return { refundId: r && r.id };
  } catch (err) {
    const e = new Error("Razorpay could not process the refund: " + ((err && err.error && err.error.description) || err.message || "unknown error"));
    e.statusCode = 502; throw e;
  }
}

module.exports = { refundAtGateway };
