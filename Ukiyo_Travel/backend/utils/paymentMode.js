const razor = require("../config/razorpay");

/**
 * Which payment gateway is active (decided per call so config changes are honoured):
 *   razorpay - real gateway (RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET set)
 *   demo     - built-in SANDBOX gateway, nothing is charged
 *   disabled - no gateway
 * The sandbox is NEVER available while Razorpay is configured, and in production it
 * must be switched on explicitly with DEMO_PAYMENTS=true (so nobody can "pay" with a test card).
 */
function paymentMode() {
  if (razor.isConfigured()) return "razorpay";
  const raw = process.env.DEMO_PAYMENTS;
  const allowed = raw === undefined || raw === "" ? process.env.NODE_ENV !== "production" : String(raw).toLowerCase() === "true";
  return allowed ? "demo" : "disabled";
}

module.exports = { paymentMode };
