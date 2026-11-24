const Review = require("../models/Review");
const Booking = require("../models/Booking");

const avg = (arr) => (arr.length ? Math.round((arr.reduce((s, r) => s + r.rating, 0) / arr.length) * 10) / 10 : null);
const isRejected = (s) => s === "rejected" || s === "hidden"; // "hidden" = legacy Command Center value

/**
 * @route POST /api/reviews  { bookingId, rating (1-5), comment }
 * Only the owner of a CONFIRMED (paid) booking can review it, once. The review starts as
 * "pending" and is invisible to the public until an admin approves it.
 */
async function createReview(req, res, next) {
  try {
    const { bookingId, comment } = req.body;
    const rating = parseInt(req.body.rating, 10);
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ success: false, message: "Please choose a rating from 1 to 5 stars." });
    if (comment && String(comment).length > 1000) return res.status(400).json({ success: false, message: "Review is too long (max 1000 characters)." });

    let booking = null;
    try { booking = await Booking.findOne({ _id: bookingId, user: req.user._id }); } catch (_) { /* bad id */ }
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.status !== "confirmed") return res.status(400).json({ success: false, message: "You can review a trip once its payment is confirmed." });
    if (await Review.exists({ booking: booking._id })) return res.status(409).json({ success: false, message: "You have already reviewed this trip." });

    const review = await Review.create({
      user: req.user._id, booking: booking._id, itemType: booking.itemType, itemId: booking.itemId, itemTitle: booking.title,
      destinationSlug: booking.destinationSlug, destinationName: booking.destinationName, rating, comment: String(comment || "").trim(),
      status: "pending",
    });
    res.status(201).json({ success: true, message: "Thanks! Your review will appear once it has been approved.", review: { _id: review._id, status: review.status } });
  } catch (err) { next(err); }
}

/**
 * @route GET /api/reviews?itemType=&itemId=&destination=&limit=
 * Public: APPROVED reviews only. average/count/distribution cover every matching approved
 * review (not just the page returned), so ratings are always correct.
 */
async function publicReviews(req, res, next) {
  try {
    const f = { status: "approved" };
    if (req.query.itemType) f.itemType = String(req.query.itemType);
    if (req.query.itemId) f.itemId = String(req.query.itemId).toLowerCase();
    if (req.query.destination) f.destinationSlug = String(req.query.destination).toLowerCase();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const all = await Review.find(f).sort({ createdAt: -1 }).populate("user", "firstName lastName");
    res.json({
      success: true, average: avg(all), count: all.length,
      distribution: [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: all.filter((r) => r.rating === n).length })),
      reviews: all.slice(0, limit).map((r) => ({
        _id: r._id, rating: r.rating, comment: r.comment, itemType: r.itemType, itemId: r.itemId, itemTitle: r.itemTitle,
        destination: r.destinationName,
        author: r.user ? `${r.user.firstName} ${String(r.user.lastName || "").charAt(0)}.` : "Traveller", createdAt: r.createdAt,
      })),
    });
  } catch (err) { next(err); }
}

/* ------------------------------ ADMIN ------------------------------ */

function group(list, keyFn) {
  const m = new Map();
  list.forEach((r) => { const k = keyFn(r); if (!k) return; (m.get(k) || m.set(k, []).get(k)).push(r); });
  return [...m.entries()].map(([name, rs]) => ({ name, average: avg(rs), count: rs.length })).sort((a, b) => b.average - a.average || b.count - a.count);
}

/**
 * @route GET /api/admin/reviews?status=pending|approved|rejected&rating=&type=&q=
 * Ratings/summary use APPROVED reviews only; pending and rejected are counted separately.
 */
async function adminReviews(req, res, next) {
  try {
    const all = await Review.find().sort({ createdAt: -1 }).populate("user", "firstName lastName email");
    const approved = all.filter((r) => r.status === "approved");
    const pending = all.filter((r) => r.status === "pending");
    const rejected = all.filter((r) => isRejected(r.status));

    const { status, rating, type, q } = req.query;
    let list = all;
    if (status === "approved") list = approved;
    else if (status === "pending") list = pending;
    else if (status === "rejected" || status === "hidden") list = rejected;
    if (/^[1-5]$/.test(rating || "")) list = list.filter((r) => r.rating === +rating);
    if (["package", "destination", "hotel"].includes(type)) list = list.filter((r) => r.itemType === type);
    if (q && q.trim()) {
      const n = q.trim().toLowerCase();
      list = list.filter((r) => [r.comment, r.itemTitle, r.destinationName, r.user && r.user.firstName, r.user && r.user.lastName, r.user && r.user.email]
        .some((v) => String(v || "").toLowerCase().includes(n)));
    }
    const shape = (r) => ({ _id: r._id, rating: r.rating, comment: r.comment, item: r.itemTitle, itemType: r.itemType, destination: r.destinationName,
      status: isRejected(r.status) ? "rejected" : r.status, customer: r.user ? `${r.user.firstName} ${r.user.lastName}` : "Deleted user", email: r.user ? r.user.email : "", createdAt: r.createdAt });

    res.json({
      success: true,
      summary: {
        average: avg(approved), count: approved.length, pending: pending.length, rejected: rejected.length, hidden: rejected.length,
        distribution: [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: approved.filter((r) => r.rating === n).length })),
        positive: approved.filter((r) => r.rating >= 4).length,
        neutral: approved.filter((r) => r.rating === 3).length,
        negative: approved.filter((r) => r.rating <= 2).length,
        destinations: group(approved, (r) => r.destinationName),
        hotels: group(approved.filter((r) => r.itemType === "hotel"), (r) => r.itemTitle),
        packages: group(approved.filter((r) => r.itemType === "package"), (r) => r.itemTitle),
        recentPositive: approved.filter((r) => r.rating >= 4 && r.comment).slice(0, 3).map(shape),
        recentNegative: approved.filter((r) => r.rating <= 2).slice(0, 3).map(shape),
      },
      count: list.length,
      reviews: list.slice(0, 300).map(shape),
    });
  } catch (err) { next(err); }
}

/** @route PATCH /api/admin/reviews/:id { status: approved|rejected|pending } */
async function adminSetReviewStatus(req, res, next) {
  try {
    let { status } = req.body;
    if (status === "hidden") status = "rejected";
    if (!["approved", "rejected", "pending"].includes(status)) return res.status(400).json({ success: false, message: "Status must be approved, rejected or pending" });
    let r = null;
    try {
      r = await Review.findByIdAndUpdate(req.params.id, { status, moderatedAt: status === "pending" ? null : new Date(), moderatedBy: status === "pending" ? null : req.user._id }, { new: true });
    } catch (_) { /* bad id */ }
    if (!r) return res.status(404).json({ success: false, message: "Review not found" });
    res.json({ success: true, message: status === "approved" ? "Review approved and now visible on the website" : status === "rejected" ? "Review rejected" : "Review moved back to pending" });
  } catch (err) { next(err); }
}

/** @route DELETE /api/admin/reviews/:id */
async function adminDeleteReview(req, res, next) {
  try {
    let r = null;
    try { r = await Review.findByIdAndDelete(req.params.id); } catch (_) { /* bad id */ }
    if (!r) return res.status(404).json({ success: false, message: "Review not found" });
    res.json({ success: true, message: "Review deleted" });
  } catch (err) { next(err); }
}

module.exports = { createReview, publicReviews, adminReviews, adminSetReviewStatus, adminDeleteReview };
