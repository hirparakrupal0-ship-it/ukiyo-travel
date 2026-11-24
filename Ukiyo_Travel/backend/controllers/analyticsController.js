const User = require("../models/User");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Enquiry = require("../models/Enquiry");
const AlertState = require("../models/AlertState");
const { loadMaps, bookingDestination } = require("../utils/catalog");
const { buildDashboard, buildTrending } = require("../utils/analytics");
const { buildInsights } = require("../utils/insights");
const { buildAlerts } = require("../utils/alertsEngine");
const { bookingAmount } = require("../utils/money");
const { dateKey, todayISO } = require("../utils/dates");

async function loadAll() {
  const [bookings, payments, users, enquiries, maps] = await Promise.all([
    Booking.find().lean(), Payment.find().lean(), User.find().select("createdAt role").lean(), Enquiry.find().lean(), loadMaps(),
  ]);
  return { bookings, payments, users, enquiries, maps, destOf: (b) => bookingDestination(maps, b) };
}

/** @route GET /api/admin/dashboard — KPIs, Travel Pulse and chart series */
async function dashboard(req, res, next) {
  try {
    const d = await loadAll();
    const result = buildDashboard({
      bookings: d.bookings, payments: d.payments, users: d.users, enquiries: d.enquiries, destOf: d.destOf,
      counts: { hotels: d.maps.hotels.length, destinations: d.maps.destinations.length, packages: d.maps.packages.length },
    });
    res.json({ success: true, today: todayISO(), ...result });
  } catch (err) { next(err); }
}

/** @route GET /api/admin/trending?window=30 */
async function trending(req, res, next) {
  try {
    const d = await loadAll();
    const window = Math.min(90, Math.max(7, parseInt(req.query.window, 10) || 30));
    res.json({ success: true, ...buildTrending({ bookings: d.bookings, destOf: d.destOf, destinations: d.maps.destinations, packages: d.maps.packages, hotels: d.maps.hotels, window }) });
  } catch (err) { next(err); }
}

/** @route GET /api/admin/insights */
async function insights(req, res, next) {
  try {
    const d = await loadAll();
    res.json({ success: true, generatedAt: new Date(), insights: buildInsights({ bookings: d.bookings, payments: d.payments, users: d.users, destOf: d.destOf }) });
  } catch (err) { next(err); }
}

/* ------------------------------ Calendar ------------------------------ */
const dayOf = (b, basis) => (basis === "created" ? dateKey(b.createdAt) : b.travelDate);

/** @route GET /api/admin/calendar?month=YYYY-MM&basis=travel|created */
async function calendar(req, res, next) {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || "") ? req.query.month : todayISO().slice(0, 7);
    const basis = req.query.basis === "created" ? "created" : "travel";
    const bookings = await Booking.find().lean();
    const days = {};
    bookings.forEach((b) => {
      const k = dayOf(b, basis);
      if (!k || !k.startsWith(month)) return;
      const d = days[k] || (days[k] = { date: k, total: 0, confirmed: 0, pending: 0, cancelled: 0, travellers: 0, amount: 0 });
      d.total += 1; d[b.status] += 1;
      if (b.status !== "cancelled") { d.travellers += b.travellers || 1; d.amount += bookingAmount(b); }
    });
    res.json({ success: true, month, basis, today: todayISO(), days: Object.values(days).sort((a, b) => a.date.localeCompare(b.date)) });
  } catch (err) { next(err); }
}

/** @route GET /api/admin/calendar/day?date=YYYY-MM-DD&basis= */
async function calendarDay(req, res, next) {
  try {
    const date = req.query.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return res.status(400).json({ success: false, message: "A valid date is required (YYYY-MM-DD)." });
    const basis = req.query.basis === "created" ? "created" : "travel";
    const [all, maps] = await Promise.all([Booking.find().sort({ createdAt: -1 }).populate("user", "firstName lastName email").lean(), loadMaps()]);
    const rows = all.filter((b) => dayOf(b, basis) === date).map((b) => ({
      _id: b._id,
      reference: b.reference || "",
      customer: b.user ? `${b.user.firstName} ${b.user.lastName}` : "Unknown",
      email: b.user ? b.user.email : "",
      destination: bookingDestination(maps, b).name || "—",
      hotel: b.itemType === "hotel" ? b.title : "",
      package: b.itemType === "package" ? b.title : "",
      itemType: b.itemType,
      travellers: b.travellers,
      amount: bookingAmount(b),
      status: b.status,
      paymentStatus: b.paymentStatus,
      travelDate: b.travelDate,
    }));
    const live = rows.filter((r) => r.status !== "cancelled");
    res.json({
      success: true, date, basis, count: rows.length,
      totals: { travellers: live.reduce((s, r) => s + r.travellers, 0), amount: live.reduce((s, r) => s + r.amount, 0) },
      bookings: rows,
    });
  } catch (err) { next(err); }
}

/* ------------------------------ Alerts ------------------------------ */

/** @route GET /api/admin/alerts — generated live; read/cleared state is per admin */
async function alerts(req, res, next) {
  try {
    const d = await loadAll();
    const list = buildAlerts({ bookings: d.bookings, payments: d.payments, enquiries: d.enquiries, users: d.users });
    const states = await AlertState.find({ admin: req.user._id, key: { $in: list.map((a) => a.key) } }).lean();
    const stateOf = new Map(states.map((s) => [s.key, s.state]));
    const visible = list.filter((a) => stateOf.get(a.key) !== "cleared").map((a) => ({ ...a, read: stateOf.get(a.key) === "read" }));
    res.json({ success: true, count: visible.length, unread: visible.filter((a) => !a.read).length, alerts: visible });
  } catch (err) { next(err); }
}

/** @route POST /api/admin/alerts/state  { key, state: "read"|"cleared" } */
async function setAlertState(req, res, next) {
  try {
    const { key, state } = req.body;
    if (!key || typeof key !== "string" || !["read", "cleared"].includes(state)) {
      return res.status(400).json({ success: false, message: "key and state (read|cleared) are required" });
    }
    await AlertState.findOneAndUpdate({ admin: req.user._id, key }, { $set: { state } }, { upsert: true });
    res.json({ success: true, message: state === "read" ? "Marked as read" : "Alert cleared" });
  } catch (err) { next(err); }
}

/** @route POST /api/admin/alerts/state-all  { state } — mark every current alert read, or clear them all */
async function setAllAlertStates(req, res, next) {
  try {
    const { state } = req.body;
    if (!["read", "cleared"].includes(state)) return res.status(400).json({ success: false, message: "state must be read or cleared" });
    const d = await loadAll();
    const list = buildAlerts({ bookings: d.bookings, payments: d.payments, enquiries: d.enquiries, users: d.users });
    await Promise.all(list.map((a) => AlertState.findOneAndUpdate({ admin: req.user._id, key: a.key }, { $set: { state } }, { upsert: true })));
    res.json({ success: true, message: state === "read" ? "All alerts marked as read" : "All alerts cleared" });
  } catch (err) { next(err); }
}

module.exports = { dashboard, trending, insights, calendar, calendarDay, alerts, setAlertState, setAllAlertStates };
