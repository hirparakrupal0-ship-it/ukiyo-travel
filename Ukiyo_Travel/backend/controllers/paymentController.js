const crypto = require("crypto");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const razor = require("../config/razorpay");
const gateway = require("../utils/gateway");
const { paymentMode } = require("../utils/paymentMode");
const { isPastDate, PAST_DATE_MESSAGE } = require("../utils/dates");
const { openAttempt, recordFailure, recordSuccess } = require("../services/paymentService");
const { refundAtGateway } = require("../services/refundService");
const { shapeBooking } = require("./bookingController");

const DECLINED_MSG = "Payment Failed. Please try again.";
const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

/** Loads the caller's booking and checks it can be paid. Returns { booking } or { error:{status,message} }. */
async function payableBooking(id, userId) {
  let booking = null;
  try { booking = await Booking.findOne({ _id: id, user: userId }); } catch (_) { /* bad id */ }
  if (!booking) return { error: { status: 404, message: "Booking not found" } };
  if (booking.status === "cancelled") return { error: { status: 400, message: "This booking was cancelled and cannot be paid." } };
  if (booking.paymentStatus === "paid" || booking.status === "confirmed") return { error: { status: 409, message: "This booking is already paid and confirmed." } };
  if (!(booking.amount > 0)) return { error: { status: 400, message: "Invalid booking amount" } };
  if (booking.travelDate && isPastDate(booking.travelDate)) return { error: { status: 400, message: `The travel date has passed. ${PAST_DATE_MESSAGE} Please make a new booking.` } };
  return { booking };
}

const latestPayment = (bookingId) => Payment.findOne({ booking: bookingId }).sort({ createdAt: -1 });

/* ------------------------------ config ------------------------------ */

/** @route GET /api/bookings/payment-options  (Command Center contract) */
function paymentOptions(req, res) {
  const mode = paymentMode();
  res.json({ success: true, mode, methods: gateway.METHODS, banks: gateway.BANKS, wallets: gateway.WALLETS, sandbox: mode === "demo" });
}

/** @route GET /api/payments/config  (Smart user site contract) */
function getConfig(req, res) {
  const mode = paymentMode();
  res.json({
    success: true, mode, enabled: mode !== "disabled", sandbox: mode === "demo",
    keyId: mode === "razorpay" ? razor.keys().KEY_ID : "",
    methods: gateway.METHODS, banks: gateway.BANKS, wallets: gateway.WALLETS,
  });
}

/* --------------------------- sandbox gateway --------------------------- */

/** Core sandbox payment. Returns { status, body } so both endpoints can shape the response. */
async function runSandbox(req, bookingId) {
  if (paymentMode() !== "demo") return { status: 503, body: { success: false, message: "The test payment gateway is not enabled." } };
  const found = await payableBooking(bookingId, req.user._id);
  if (found.error) return { status: found.error.status, body: { success: false, message: found.error.message } };
  const { booking } = found;

  const method = req.body.method;
  const checked = gateway.validateInput(method, gateway.normalizeInput(req.body));
  if (checked.error) return { status: 400, body: { success: false, message: checked.error, code: "INVALID_DETAILS" } };

  const payment = await openAttempt(booking, { method, gateway: "sandbox" });
  const result = await gateway.charge({ method, details: checked.details });

  if (!result.ok) {
    const failed = await recordFailure(payment, result.reason, result.details || {});
    const fresh = await Booking.findById(booking._id);
    return { status: 200, outcome: "failed", reason: result.reason, booking: shapeBooking(fresh, failed, false) };
  }
  const done = await recordSuccess(payment, { transactionId: result.transactionId, details: result.details, method });
  if (!done.ok) return { status: 409, body: { success: false, message: "This booking was already paid or changed." } };
  return { status: 200, outcome: "paid", booking: shapeBooking(done.booking, done.payment, false) };
}

/** @route POST /api/bookings/:id/pay  { method, cardNumber…|upiId|bank|wallet } — Command Center contract */
async function payBooking(req, res, next) {
  try {
    const r = await runSandbox(req, req.params.id);
    if (r.body) return res.status(r.status).json(r.body);
    if (r.outcome === "failed") return res.json({ success: true, outcome: "failed", message: `Payment failed: ${r.reason} You can retry.`, booking: r.booking });
    res.json({ success: true, outcome: "paid", message: "Payment successful. Your booking is confirmed!", booking: r.booking });
  } catch (err) { next(err); }
}

/** @route POST /api/payments/demo  { bookingId, method, upiId | card{} | bank } — Smart user-site contract */
async function payDemo(req, res, next) {
  try {
    const r = await runSandbox(req, req.body.bookingId);
    if (r.body) return res.status(r.status).json(r.body);
    if (r.outcome === "failed") return fail(res, 402, DECLINED_MSG, { code: "DECLINED", reason: r.reason });
    res.json({ success: true, message: "Payment Successful! Your booking has been confirmed.", booking: r.booking });
  } catch (err) { next(err); }
}

/* ------------------------------ Razorpay ------------------------------ */

/** @route POST /api/payments/order  { bookingId } */
async function createOrder(req, res, next) {
  try {
    const rz = paymentMode() === "razorpay" ? razor.getInstance() : null;
    if (!rz) return fail(res, 503, "Payments are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the .env file.");
    const found = await payableBooking(req.body.bookingId, req.user._id);
    if (found.error) return fail(res, found.error.status, found.error.message);
    const { booking } = found;

    const order = await rz.orders.create({
      amount: Math.round(booking.amount * 100), // paise
      currency: "INR",
      receipt: "rcpt_" + booking._id,
      notes: { bookingId: String(booking._id), title: booking.title },
    });
    await openAttempt(booking, { gateway: "razorpay", gatewayOrderId: order.id });
    res.json({
      success: true, orderId: order.id, amount: order.amount, currency: order.currency, keyId: razor.keys().KEY_ID,
      booking: { id: booking._id, title: booking.title, travellers: booking.travellers },
    });
  } catch (err) { next(err); }
}

const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

/** @route POST /api/payments/verify — verifies the Razorpay signature, then confirms the booking */
async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId, method } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return fail(res, 400, "Missing payment fields");
    if (paymentMode() !== "razorpay") return fail(res, 503, "Razorpay is not enabled.");

    let booking = null;
    try { booking = await Booking.findOne({ _id: bookingId, user: req.user._id }); } catch (_) { /* bad id */ }
    if (!booking) return fail(res, 404, "Booking not found");
    const payment = await Payment.findOne({ booking: booking._id, gateway: "razorpay", gatewayOrderId: razorpay_order_id });
    if (!payment) return fail(res, 400, DECLINED_MSG, { code: "DECLINED" });

    if (payment.status === "paid") { // already processed (e.g. by the webhook): idempotent success
      const b = await Booking.findById(booking._id);
      return res.json({ success: true, message: "Already paid", booking: shapeBooking(b, payment, false) });
    }
    const expected = hmac(razor.keys().KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (!safeEqual(expected, razorpay_signature)) {
      await recordFailure(payment, "Payment signature could not be verified.");
      return fail(res, 400, DECLINED_MSG, { code: "DECLINED" });
    }
    const done = await recordSuccess(payment, { transactionId: razorpay_payment_id, gatewayPaymentId: razorpay_payment_id, method: gateway.METHODS.includes(method) ? method : undefined, details: {} });
    if (!done.ok) return fail(res, 409, "This booking was already paid or cancelled. If you were charged, contact support for a refund.");
    res.json({ success: true, message: "Payment Successful! Your booking has been confirmed.", booking: shapeBooking(done.booking, done.payment, false) });
  } catch (err) { next(err); }
}

/** @route POST /api/payments/failed  { bookingId } — the browser reports a failed/aborted Razorpay attempt */
async function markFailed(req, res, next) {
  try {
    let booking = null;
    try { booking = await Booking.findOne({ _id: req.body.bookingId, user: req.user._id }); } catch (_) { /* bad id */ }
    if (booking && booking.paymentStatus !== "paid") {
      const p = await Payment.findOne({ booking: booking._id, status: "pending", attemptedAt: { $ne: null } }).sort({ createdAt: -1 });
      if (p) await recordFailure(p, "Payment failed or was cancelled at the gateway.");
    }
    res.json({ success: true });
  } catch (err) { next(err); }
}

/**
 * @route POST /api/payments/webhook — Razorpay server-to-server events (needs RAZORPAY_WEBHOOK_SECRET).
 * Confirms a payment even if the customer closed the browser before /verify ran. Idempotent.
 * The route receives the RAW body (see app.js) because the signature covers the exact bytes.
 */
async function webhook(req, res, next) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return fail(res, 503, "Webhook is not configured.");
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!safeEqual(hmac(secret, raw), req.headers["x-razorpay-signature"] || "")) return fail(res, 400, "Invalid signature");

    const event = JSON.parse(raw.toString("utf8"));
    const ent = event && event.payload && event.payload.payment && event.payload.payment.entity;
    if (ent && ent.order_id) {
      const payment = await Payment.findOne({ gateway: "razorpay", gatewayOrderId: ent.order_id });
      if (payment && payment.status === "pending") {
        if (event.event === "payment.captured" || event.event === "order.paid") {
          await recordSuccess(payment, { transactionId: ent.id, gatewayPaymentId: ent.id, method: gateway.METHODS.includes(ent.method) ? ent.method : undefined });
        } else if (event.event === "payment.failed") {
          await recordFailure(payment, (ent.error_description) || "Payment failed at the gateway.");
        }
      }
    }
    res.json({ success: true });
  } catch (err) { next(err); }
}

/* ------------------------------ ADMIN ------------------------------ */

function shapePayment(p) {
  const b = p.booking || {};
  const u = p.user || {};
  return {
    _id: p._id,
    paymentId: p.paymentId,
    bookingId: b._id || null,
    bookingReference: b.reference || b.bookingRef || "",
    customer: u.firstName ? `${u.firstName} ${u.lastName}` : "Unknown",
    email: u.email || "",
    item: b.title || "—",
    itemType: b.itemType || "",
    amount: p.amount,
    method: p.method,
    status: p.status,
    gateway: p.gateway || "sandbox",
    date: p.paidAt || p.attemptedAt || p.createdAt,
    transactionId: p.transactionId,
    failureReason: p.failureReason,
    details: p.details || {},
    bookingStatus: b.status || "",
    travelDate: b.travelDate || "",
    travellers: b.travellers || 0,
    createdAt: p.createdAt,
  };
}

/**
 * @route GET /api/admin/payments?status=&method=&from=YYYY-MM-DD&to=YYYY-MM-DD&q=
 * Summary cards always reflect the filtered set.
 */
async function adminGetPayments(req, res, next) {
  try {
    const { status, method, from, to, q } = req.query;
    const filter = {};
    if (["pending", "paid", "failed", "cancelled", "refunded"].includes(status)) filter.status = status;
    if (["card", "upi", "netbanking", "wallet"].includes(method)) filter.method = method;
    const range = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(from || "")) range.$gte = new Date(from + "T00:00:00+05:30");
    if (/^\d{4}-\d{2}-\d{2}$/.test(to || "")) range.$lte = new Date(to + "T23:59:59.999+05:30");
    if (Object.keys(range).length) filter.createdAt = range;

    let rows = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(2000)
      .populate("user", "firstName lastName email")
      .populate("booking", "reference bookingRef title itemType status travelDate travellers");
    rows = rows.map(shapePayment);

    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((r) =>
        [r.paymentId, r.bookingReference, r.customer, r.email, r.item, r.transactionId, String(r.bookingId || "")]
          .some((v) => String(v || "").toLowerCase().includes(needle))
      );
    }

    const summary = { total: rows.length, paid: 0, pending: 0, failed: 0, cancelled: 0, refunded: 0, collected: 0, refundedAmount: 0, pendingAmount: 0 };
    rows.forEach((r) => {
      summary[r.status] += 1;
      if (r.status === "paid") summary.collected += r.amount;
      if (r.status === "refunded") summary.refundedAmount += r.amount;
      if (r.status === "pending") summary.pendingAmount += r.amount;
    });
    res.json({ success: true, count: rows.length, summary, payments: rows });
  } catch (err) { next(err); }
}

/** @route GET /api/admin/payments/:id */
async function adminGetPayment(req, res, next) {
  try {
    const p = await Payment.findById(req.params.id)
      .populate("user", "firstName lastName email phone")
      .populate("booking");
    if (!p) return res.status(404).json({ success: false, message: "Payment not found" });
    const attempts = await Payment.find({ booking: p.booking && p.booking._id }).sort({ createdAt: 1 }).select("paymentId status method createdAt failureReason");
    res.json({ success: true, payment: shapePayment(p), attempts });
  } catch (err) { next(err); }
}

/** @route POST /api/admin/payments/:id/refund — refund a paid payment and cancel its booking */
async function adminRefund(req, res, next) {
  try {
    const p = await Payment.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: "Payment not found" });
    if (p.status !== "paid") return res.status(400).json({ success: false, message: "Only paid payments can be refunded." });
    const { refundId } = await refundAtGateway(p); // throws 502 if the gateway refuses -> nothing changes
    const now = new Date();
    p.status = "refunded"; p.refundedAt = now; if (refundId) p.refundId = refundId;
    await p.save();
    const booking = await Booking.findById(p.booking);
    if (booking) {
      booking.paymentStatus = "refunded";
      booking.status = "cancelled";
      booking.cancelledAt = now;
      await booking.save();
    }
    res.json({ success: true, message: "Payment refunded and booking cancelled." });
  } catch (err) { next(err); }
}

module.exports = { paymentOptions, getConfig, payBooking, payDemo, createOrder, verifyPayment, markFailed, webhook, adminGetPayments, adminGetPayment, adminRefund };
