/* Razorpay is OPTIONAL. The SDK is only loaded when both keys are present, so the
   project runs fine (in sandbox mode) without the package being configured. */
let cached = null;

function keys() {
  return { KEY_ID: process.env.RAZORPAY_KEY_ID || "", KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "" };
}

function isConfigured() {
  const { KEY_ID, KEY_SECRET } = keys();
  return Boolean(KEY_ID && KEY_SECRET);
}

/** Lazily created SDK client (or null when not configured). */
function getInstance() {
  if (!isConfigured()) return null;
  if (!cached) {
    const Razorpay = require("razorpay");
    const { KEY_ID, KEY_SECRET } = keys();
    cached = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  }
  return cached;
}

/** Test hook: inject a fake client. */
function _setInstanceForTests(fake) { cached = fake; }

module.exports = { isConfigured, getInstance, keys, _setInstanceForTests };
