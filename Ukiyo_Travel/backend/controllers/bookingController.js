const { validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const { loadMaps, findItem, destinationOf } = require("../utils/catalog");
const { priceToNumber, bookingAmount } = require("../utils/money");
const { isValidISODate, isPastDate, PAST_DATE_MESSAGE } = require("../utils/dates");
const { paymentId } = require("../utils/reference");
const { cancelAndRefund } = require("../utils/bookingOps");
const { noteFor } = require("../utils/gateway");

function collectValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    return true;
  }
  return false;
}

/** What the My Trips UI needs to know about a booking. */
function shapeBooking(b, payment, reviewed, reviewStatus) {
  const o = b.toObject ? b.toObject() : b;
  const unpaid = o.status === "pending";
  const method = payment && payment.method;
  return {
    ...o,
    // Aliases so the Smart user site's receipt fields keep working.
    reference: o.reference || o.bookingRef || "",
    bookingRef: o.reference || o.bookingRef || "",
    paymentMethod: method || o.paymentMethod || "",
    paymentNote: payment ? noteFor(method, payment.details) : o.paymentNote || "",
    reviewStatus: reviewStatus || "",
    amount: bookingAmount(o),
    statusLabel: o.status === "pending" ? "Pending Payment" : o.status === "confirmed" ? "Confirmed" : "Cancelled",
    canPay: unpaid && !isPastDate(o.travelDate || "9999-12-31"),
    canRetry: unpaid && o.paymentStatus === "failed" && !isPastDate(o.travelDate || "9999-12-31"),
    canReview: o.status === "confirmed" && !reviewed,
    reviewed: !!reviewed,
    payment: payment
      ? { paymentId: payment.paymentId, status: payment.status, method: payment.method, failureReason: payment.failureReason,
          transactionId: payment.transactionId, paidAt: payment.paidAt, details: payment.details }
      : null,
  };
}

/**
 * @route   POST /api/bookings
 * @desc    Create a booking in "Pending Payment" state plus an open payment record.
 *          Price is taken from the catalog (never trusted from the browser).
 */
async function createBooking(req, res, next) {
  try {
    if (collectValidation(req, res)) return;
    const { itemType, itemId, travelDate, travellers, notes } = req.body;

    if (!travelDate || !isValidISODate(travelDate)) {
      return res.status(400).json({ success: false, message: "Please choose a valid travel date." });
    }
    if (isPastDate(travelDate)) {
      return res.status(400).json({ success: false, message: PAST_DATE_MESSAGE });
    }

    const maps = await loadMaps();
    const item = findItem(maps, itemType, itemId);
    if (!item) return res.status(404).json({ success: false, message: "This item could not be found." });
    if (item.isActive === false) {
      return res.status(400).json({ success: false, message: "Sorry, this item is no longer available for booking." });
    }

    const pax = parseInt(travellers, 10) || 1;
    const unitPrice = priceToNumber(itemType === "destination" ? item.priceFrom : item.price);
    if (!unitPrice) return res.status(400).json({ success: false, message: "This item has no valid price yet." });
    const title = itemType === "destination" ? item.name : itemType === "package" ? item.title : `${item.name} · ${item.city}`;
    const dest = destinationOf(maps, itemType, itemId, title);

    const booking = await Booking.create({
      user: req.user._id,
      itemType,
      itemId: String(itemId).toLowerCase(),
      title,
      price: itemType === "destination" ? item.priceFrom : item.price,
      unitPrice,
      amount: unitPrice * pax,
      travelDate,
      travellers: pax,
      notes: notes || "",
      destinationSlug: dest.slug,
      destinationName: dest.name,
    });
    const payment = await Payment.create({
      paymentId: paymentId(), booking: booking._id, user: req.user._id, amount: booking.amount,
    });

    res.status(201).json({
      success: true,
      message: "Booking created. Complete payment to confirm it.",
      booking: shapeBooking(booking, payment, false),
    });
  } catch (err) {
    next(err);
  }
}

/** @route GET /api/bookings — the user's own bookings, newest first, with latest payment + review state */
async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });
    const ids = bookings.map((b) => b._id);
    const [payments, reviews] = await Promise.all([
      Payment.find({ booking: { $in: ids } }).sort({ createdAt: -1 }),
      Review.find({ booking: { $in: ids } }).select("booking status"),
    ]);
    const latest = new Map();
    payments.forEach((p) => { if (!latest.has(String(p.booking))) latest.set(String(p.booking), p); });
    const reviewed = new Map(reviews.map((r) => [String(r.booking), r.status]));
    const out = bookings.map((b) => shapeBooking(b, latest.get(String(b._id)), reviewed.has(String(b._id)), reviewed.get(String(b._id))));
    res.json({ success: true, count: out.length, bookings: out });
  } catch (err) {
    next(err);
  }
}

/** @route GET /api/bookings/:id — ticket / booking details */
async function getMyBooking(req, res, next) {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    const [payment, review] = await Promise.all([
      Payment.findOne({ booking: booking._id }).sort({ createdAt: -1 }),
      Review.findOne({ booking: booking._id }).select("_id status"),
    ]);
    res.json({ success: true, booking: shapeBooking(booking, payment, !!review, review && review.status) });
  } catch (err) {
    next(err);
  }
}

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Cancel one of the user's bookings. Kept (status "cancelled") so history,
 *          analytics and refunds stay accurate; a paid booking is refunded.
 */
async function cancelBooking(req, res, next) {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.status === "cancelled") return res.json({ success: true, message: "Booking already cancelled", booking });
    await cancelAndRefund(booking);
    res.json({
      success: true,
      message: booking.paymentStatus === "refunded" ? "Booking cancelled and payment refunded" : "Booking cancelled",
      booking,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createBooking, getMyBookings, getMyBooking, cancelBooking, shapeBooking };
