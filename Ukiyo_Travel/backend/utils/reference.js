const crypto = require("crypto");
// No 0/O/1/I to keep references readable on a ticket.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(len) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** UKY-2026-XXXXX (year is the current year, detected at call time). */
const bookingReference = (now = new Date()) => `UKY-${now.getFullYear()}-${randomCode(5)}`;
const paymentId = () => `PAY-${randomCode(8)}`;
const transactionId = () => `TXN${Date.now().toString(36).toUpperCase()}${randomCode(5)}`;

module.exports = { bookingReference, paymentId, transactionId };
