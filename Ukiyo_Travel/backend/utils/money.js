/* "₹9,999" -> 9999 */
function priceToNumber(str) {
  if (typeof str === "number") return Number.isFinite(str) ? str : 0;
  const n = parseInt(String(str || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Amount for a booking. New bookings store `amount`; legacy ones are derived. */
function bookingAmount(b) {
  if (typeof b.amount === "number" && b.amount > 0) return b.amount;
  return priceToNumber(b.price) * (b.travellers || 1);
}

module.exports = { priceToNumber, bookingAmount };
