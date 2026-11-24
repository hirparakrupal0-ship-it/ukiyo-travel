/* =========================================================
   Payment state machine shared by every gateway (sandbox + Razorpay + webhook).
   All transitions are guarded with atomic conditional updates, so a double-click,
   a retry, or a webhook racing the browser can never confirm a booking twice or
   create two "paid" records for one booking.
========================================================= */
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const { bookingReference, paymentId } = require("../utils/reference");

const isDuplicateKey = (err) => !!err && (err.code === 11000 || /duplicate key|UNIQUE constraint/i.test(String(err.message)));

async function uniqueReference() {
  for (let i = 0; i < 8; i++) {
    const ref = bookingReference();
    if (!(await Booking.exists({ reference: ref }))) return ref;
  }
  throw new Error("Could not generate a booking reference");
}

/** Reuse the open (pending) attempt for a booking, otherwise start a new one (e.g. after a failure). */
async function openAttempt(booking, { method = null, gateway = "sandbox", gatewayOrderId } = {}) {
  let payment = await Payment.findOne({ booking: booking._id, status: "pending" }).sort({ createdAt: -1 });
  if (!payment) payment = new Payment({ paymentId: paymentId(), booking: booking._id, user: booking.user, amount: booking.amount });
  payment.amount = booking.amount;
  payment.method = method;
  payment.gateway = gateway;
  payment.attemptedAt = new Date();
  payment.status = "pending";
  if (gatewayOrderId) payment.gatewayOrderId = gatewayOrderId;
  await payment.save();
  return payment;
}

/** A declined / failed attempt. The booking stays "Pending Payment" and can be retried. */
async function recordFailure(payment, reason, details = {}) {
  const p = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "pending" },
    { $set: { status: "failed", failureReason: reason, details } },
    { new: true }
  );
  await Booking.updateOne({ _id: payment.booking, status: "pending", paymentStatus: { $ne: "paid" } }, { $set: { paymentStatus: "failed" } });
  return p || payment;
}

/**
 * A verified successful payment. Returns { ok:true, booking, payment } or { ok:false, reason }.
 * Step 1 claims the payment (the unique `paidFor` index lets exactly one payment per booking win,
 * even if two requests race); step 2 confirms the booking.
 */
async function recordSuccess(payment, { transactionId = "", details = {}, method, gatewayPaymentId } = {}) {
  const paidAt = new Date();
  const set = { status: "paid", transactionId, details, failureReason: "", paidAt, paidFor: payment.booking };
  if (method) set.method = method;
  if (gatewayPaymentId) set.gatewayPaymentId = gatewayPaymentId;

  let claimed = null;
  try {
    claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: { $ne: "paid" } }, { $set: set }, { new: true });
  } catch (err) {
    if (isDuplicateKey(err)) claimed = null; // another payment already won this booking
    else throw err;
  }
  if (!claimed) {
    if (payment.gateway !== "razorpay") await Payment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "cancelled", cancelledAt: new Date(), failureReason: "Booking was already paid." } });
    return { ok: false, reason: "already-paid" };
  }

  const reference = await uniqueReference();
  const booking = await Booking.findOneAndUpdate(
    { _id: payment.booking, status: "pending", paymentStatus: { $ne: "paid" } },
    { $set: { status: "confirmed", paymentStatus: "paid", paidAt, reference } },
    { new: true }
  );
  if (!booking) {
    // The booking was cancelled while the payment was in flight.
    if (payment.gateway !== "razorpay") { // sandbox: no money moved, so undo the claim
      await Payment.updateOne({ _id: payment._id }, { $set: { status: "cancelled", cancelledAt: new Date(), failureReason: "Booking was no longer payable." }, $unset: { paidFor: "" } });
    } // razorpay: real money moved - keep it PAID so an admin can refund it from the Payments page
    return { ok: false, reason: "cancelled" };
  }
  return { ok: true, booking, payment: claimed };
}

module.exports = { uniqueReference, openAttempt, recordFailure, recordSuccess };
