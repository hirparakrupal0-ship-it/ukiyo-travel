const User = require("../models/User");
const Booking = require("../models/Booking");
const Enquiry = require("../models/Enquiry");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const publicUser = require("../utils/publicUser");
const { loadMaps, bookingDestination } = require("../utils/catalog");
const { bookingAmount } = require("../utils/money");
const { cancelAndRefund } = require("../utils/bookingOps");
const { countBy, top } = require("../utils/analytics");

// Parse "₹9,999" -> 9999 for rough revenue totals.
function priceToNumber(str) {
  const n = parseInt(String(str || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @route GET /api/admin/stats
 * @desc  Dashboard summary + recent activity
 */
async function getStats(req, res, next) {
  try {
    const [userCount, bookingCount, enquiryCount, adminCount, bookings, paidPayments] = await Promise.all([
      User.countDocuments(),
      Booking.countDocuments(),
      Enquiry.countDocuments(),
      User.countDocuments({ role: "admin" }),
      Booking.find().sort({ createdAt: -1 }),
      Payment.find({ status: "paid" }).select("amount").lean(),
    ]);

    const byStatus = { pending: 0, confirmed: 0, cancelled: 0 };
    // Revenue = verified (paid) payment records only; refunded/failed/pending never count.
    const revenue = paidPayments.reduce((s, p) => s + p.amount, 0);
    bookings.forEach((b) => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });

    // Popular destinations from bookings
    const popular = {};
    bookings.forEach((b) => { popular[b.title] = (popular[b.title] || 0) + 1; });
    const topItems = Object.entries(popular)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));

    const recentBookings = bookings.slice(0, 6);
    const recentUserIds = [...new Set(recentBookings.map((b) => String(b.user)))];
    const users = await User.find({ _id: { $in: recentUserIds } });
    const nameById = {};
    users.forEach((u) => { nameById[String(u._id)] = `${u.firstName} ${u.lastName}`; });

    res.json({
      success: true,
      stats: {
        users: userCount,
        admins: adminCount,
        bookings: bookingCount,
        enquiries: enquiryCount,
        revenue,
        byStatus,
        topItems,
      },
      recentBookings: recentBookings.map((b) => ({
        _id: b._id,
        title: b.title,
        status: b.status,
        travellers: b.travellers,
        travelDate: b.travelDate,
        price: b.price,
        customer: nameById[String(b.user)] || "Unknown",
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** Activity figures for one user, derived from their real bookings and payments. */
function userActivity(bookings, payments, maps) {
  const live = bookings.filter((b) => b.status !== "cancelled");
  const fav = top(countBy(live, (b) => bookingDestination(maps, b).name));
  const last = bookings.reduce((m, b) => (!m || b.createdAt > m ? b.createdAt : m), null);
  return {
    totalBookings: bookings.length,
    confirmedBookings: bookings.filter((b) => b.status === "confirmed").length,
    totalSpent: payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0),
    lastBooking: last,
    favouriteDestination: fav ? fav.name : null,
  };
}
const withStatus = (u, activity) => ({ ...publicUser(u), isActive: u.isActive !== false, status: u.isActive === false ? "Inactive" : "Active", lastLogin: u.lastLogin || null, ...activity });

/**
 * @route GET /api/admin/users
 * Every figure (bookings, spend, favourite destination…) is calculated from booking/payment records.
 */
async function getUsers(req, res, next) {
  try {
    const [users, bookings, payments, maps] = await Promise.all([
      User.find().sort({ createdAt: -1 }), Booking.find().lean(), Payment.find().lean(), loadMaps(),
    ]);
    const bByUser = new Map(), pByUser = new Map();
    bookings.forEach((b) => { const k = String(b.user); (bByUser.get(k) || bByUser.set(k, []).get(k)).push(b); });
    payments.forEach((p) => { const k = String(p.user); (pByUser.get(k) || pByUser.set(k, []).get(k)).push(p); });
    const out = users.map((u) => withStatus(u, userActivity(bByUser.get(String(u._id)) || [], pByUser.get(String(u._id)) || [], maps)));
    res.json({ success: true, count: out.length, users: out });
  } catch (err) {
    next(err);
  }
}

/** @route GET /api/admin/users/:id — profile + bookings + payment history */
async function getUserDetail(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const [bookings, payments, maps] = await Promise.all([
      Booking.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
      Payment.find({ user: user._id }).sort({ createdAt: -1 }).populate("booking", "title reference").lean(),
      loadMaps(),
    ]);
    res.json({
      success: true,
      user: withStatus(user, userActivity(bookings, payments, maps)),
      bookings: bookings.map((b) => ({ ...b, amount: bookingAmount(b), destination: bookingDestination(maps, b).name })),
      payments: payments.map((p) => ({ _id: p._id, paymentId: p.paymentId, amount: p.amount, method: p.method, status: p.status,
        date: p.paidAt || p.attemptedAt || p.createdAt, item: p.booking ? p.booking.title : "—", bookingReference: p.booking ? p.booking.reference || "" : "" })),
    });
  } catch (err) {
    next(err);
  }
}

/** @route PATCH /api/admin/users/:id/active  { isActive } — deactivated users cannot log in or use the API */
async function setUserActive(req, res, next) {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") return res.status(400).json({ success: false, message: "isActive must be true or false" });
    if (String(req.user._id) === String(req.params.id) && !isActive) {
      return res.status(400).json({ success: false, message: "You cannot deactivate your own account" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.isActive = isActive;
    await user.save();
    res.json({ success: true, message: isActive ? "User activated" : "User deactivated", user: withStatus(user, {}) });
  } catch (err) {
    next(err);
  }
}

/**
 * @route PATCH /api/admin/users/:id/role  { role }
 */
async function setUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be 'user' or 'admin'" });
    }
    if (String(req.user._id) === String(req.params.id) && role !== "admin") {
      return res.status(400).json({ success: false, message: "You cannot remove your own admin access" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.role = role;
    await user.save();
    res.json({ success: true, message: "Role updated", user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/**
 * @route DELETE /api/admin/users/:id
 */
async function deleteUser(req, res, next) {
  try {
    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account here" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    await user.deleteOne();
    await Promise.all([Booking.deleteMany({ user: req.params.id }), Payment.deleteMany({ user: req.params.id }), Review.deleteMany({ user: req.params.id })]);
    res.json({ success: true, message: "User and their bookings, payments and reviews removed" });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /api/admin/bookings
 * Adds amount, reference, destination and the latest payment to every booking.
 */
async function getBookings(req, res, next) {
  try {
    const [bookings, payments, maps] = await Promise.all([
      Booking.find().sort({ createdAt: -1 }).populate("user", "firstName lastName email").lean(),
      Payment.find().sort({ createdAt: -1 }).lean(),
      loadMaps(),
    ]);
    const latest = new Map();
    payments.forEach((p) => { if (!latest.has(String(p.booking))) latest.set(String(p.booking), p); });
    const out = bookings.map((b) => {
      const p = latest.get(String(b._id));
      return { ...b, amount: bookingAmount(b), destination: bookingDestination(maps, b).name,
        payment: p ? { _id: p._id, paymentId: p.paymentId, status: p.status, method: p.method } : null };
    });
    res.json({ success: true, count: out.length, bookings: out });
  } catch (err) {
    next(err);
  }
}

/**
 * @route PATCH /api/admin/bookings/:id  { status }
 * Rule: a booking can only become "confirmed" once its payment is Paid.
 */
async function setBookingStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (status === "confirmed" && booking.paymentStatus !== "paid") {
      return res.status(400).json({ success: false, message: "A booking can only be confirmed after its payment is completed." });
    }
    if (status === "pending" && booking.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "A paid booking cannot be moved back to Pending Payment." });
    }
    if (status === "pending" && booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "A cancelled booking cannot be reopened. Ask the customer to book again." });
    }
    if (status === "cancelled") {
      await cancelAndRefund(booking);
      return res.json({ success: true, message: booking.paymentStatus === "refunded" ? "Booking cancelled and payment refunded" : "Booking cancelled", booking });
    }
    booking.status = status;
    await booking.save();
    res.json({ success: true, message: "Booking updated", booking });
  } catch (err) {
    next(err);
  }
}

/**
 * @route DELETE /api/admin/bookings/:id
 */
async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    await Promise.all([Payment.deleteMany({ booking: booking._id }), Review.deleteMany({ booking: booking._id })]);
    await booking.deleteOne();
    res.json({ success: true, message: "Booking deleted" });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /api/admin/enquiries
 */
async function getEnquiries(req, res, next) {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json({ success: true, count: enquiries.length, enquiries });
  } catch (err) {
    next(err);
  }
}

/**
 * @route DELETE /api/admin/enquiries/:id
 */
async function deleteEnquiry(req, res, next) {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    await enquiry.deleteOne();
    res.json({ success: true, message: "Enquiry deleted" });
  } catch (err) {
    next(err);
  }
}

/** @route PATCH /api/admin/enquiries/:id  { status: "new" | "handled" } */
async function setEnquiryStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!["new", "handled"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    enquiry.status = status;
    enquiry.handledAt = status === "handled" ? new Date() : null;
    await enquiry.save();
    res.json({ success: true, message: status === "handled" ? "Marked as handled" : "Marked as new", enquiry });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  getUserDetail,
  setUserActive,
  setEnquiryStatus,
  getUsers,
  setUserRole,
  deleteUser,
  getBookings,
  setBookingStatus,
  deleteBooking,
  getEnquiries,
  deleteEnquiry,
};
