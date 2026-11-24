const mongoose = require("mongoose");

/**
 * One document per payment ATTEMPT. A booking can have several (e.g. failed, then paid on retry).
 *
 * status:
 *   pending   - awaiting payment (or an attempt is in progress)
 *   paid      - verified by the backend (sandbox gateway result or Razorpay signature/webhook)
 *   failed    - the gateway declined / verification failed; the booking stays "Pending Payment" and can retry
 *   cancelled - the booking was cancelled before this attempt was paid
 *   refunded  - a paid payment that was refunded
 * Revenue figures on the admin dashboard only ever sum status === "paid".
 */
const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true, unique: true },       // PAY-XXXXXXXX
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    method: { type: String, enum: ["card", "upi", "netbanking", "wallet", null], default: null },
    status: { type: String, enum: ["pending", "paid", "failed", "cancelled", "refunded"], default: "pending", index: true },
    gateway: { type: String, enum: ["sandbox", "razorpay"], default: "sandbox" },
    transactionId: { type: String, default: "" },
    // Razorpay identifiers. Left UNSET (not "") until known, so the unique sparse index below
    // guarantees the same gateway payment can never be recorded - or counted - twice.
    gatewayOrderId: { type: String, default: undefined, index: true },
    gatewayPaymentId: { type: String, default: undefined, unique: true, sparse: true },
    // Set only when the payment is PAID. The unique sparse index makes it impossible (even under a race)
    // for one booking to have two paid payments, so revenue can never be double counted.
    paidFor: { type: mongoose.Schema.Types.ObjectId, default: undefined, unique: true, sparse: true },
    refundId: { type: String, default: undefined },
    failureReason: { type: String, default: "" },
    details: { type: Object, default: {} },        // masked only: last4 / masked UPI / bank / wallet
    attemptedAt: { type: Date, default: null },    // when the customer pressed Pay
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
