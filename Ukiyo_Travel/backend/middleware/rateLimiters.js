const rateLimit = require("express-rate-limit");

const make = (envKey, def, message) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => parseInt(process.env[envKey], 10) || def,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message },
});

// Slows brute-force login attempts.
const authLimiter = make("AUTH_RATE_LIMIT_MAX", 100, "Too many requests, please try again later.");
// Slows card-testing style abuse of the payment endpoints.
const payLimiter = make("PAY_RATE_LIMIT_MAX", 120, "Too many payment requests, please try again later.");

module.exports = { authLimiter, payLimiter };
