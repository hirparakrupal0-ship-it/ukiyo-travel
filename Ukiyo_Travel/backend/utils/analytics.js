/* Pure analytics: take plain data in, return numbers out. No DB access here,
   so every figure on the dashboard is derived from real records and is testable. */
const { dateKey, addDays } = require("./dates");
const { bookingAmount } = require("./money");

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const live = (b) => b.status !== "cancelled";

function countBy(list, keyFn) {
  const m = new Map();
  list.forEach((x) => { const k = keyFn(x); if (k) m.set(k, (m.get(k) || 0) + 1); });
  return m;
}
function top(map) {
  let best = null;
  map.forEach((n, k) => { if (!best || n > best.count) best = { name: k, count: n }; });
  return best;
}
const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

/** Inclusive list of YYYY-MM-DD keys for the last n days ending at `today`. */
function lastDays(today, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}
const inRange = (iso, from, to) => iso >= from && iso <= to;

/** bookings created in [from,to] (date keys) */
function createdBetween(bookings, from, to) {
  return bookings.filter((b) => inRange(dateKey(b.createdAt), from, to));
}

function buildDashboard({ bookings, payments, users, enquiries, counts, destOf, now = new Date() }) {
  const today = dateKey(now);
  const liveB = bookings.filter(live);
  const paid = payments.filter((p) => p.status === "paid");

  const kpis = {
    users: users.length,
    bookings: bookings.length,
    revenue: paid.reduce((s, p) => s + p.amount, 0),
    hotels: counts.hotels,
    destinations: counts.destinations,
    packages: counts.packages,
    enquiries: enquiries.length,
    pendingPayments: bookings.filter((b) => b.status === "pending").length,
    pendingPaymentsAmount: bookings.filter((b) => b.status === "pending").reduce((s, b) => s + bookingAmount(b), 0),
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

  // ----- Travel Pulse -----
  const popDest = top(countBy(liveB, (b) => destOf(b).name));
  const popHotel = top(countBy(liveB.filter((b) => b.itemType === "hotel"), (b) => b.title));
  const popPkg = top(countBy(liveB.filter((b) => b.itemType === "package"), (b) => b.title));
  const popMonth = top(countBy(liveB.filter((b) => b.travelDate), (b) => MONTHS[parseInt(b.travelDate.slice(5, 7), 10) - 1]));
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const cur7 = createdBetween(bookings, addDays(today, -6), today).length;
  const prev7 = createdBetween(bookings, addDays(today, -13), addDays(today, -7)).length;

  const pulse = {
    popularDestination: popDest,
    mostBookedHotel: popHotel,
    popularPackage: popPkg,
    popularTravelMonth: popMonth,
    averageBookingValue: confirmed.length ? Math.round(confirmed.reduce((s, b) => s + bookingAmount(b), 0) / confirmed.length) : null,
    bookingGrowth: { percent: pct(cur7, prev7), thisWeek: cur7, lastWeek: prev7 },
    cancellationRate: bookings.length ? Math.round((kpis.cancelled / bookings.length) * 1000) / 10 : null,
    upcomingTrips: confirmed.filter((b) => b.travelDate >= today).length,
    todaysBookings: createdBetween(bookings, today, today).length,
  };

  // ----- Charts -----
  const days = lastDays(today, 30);
  const bPerDay = countBy(bookings, (b) => dateKey(b.createdAt));
  const revPerDay = new Map();
  paid.forEach((p) => { const k = dateKey(p.paidAt || p.createdAt); revPerDay.set(k, (revPerDay.get(k) || 0) + p.amount); });

  const monthKeys = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(now); d.setMonth(d.getMonth() - i, 1); monthKeys.push(dateKey(d).slice(0, 7)); }
  const usersPerMonth = countBy(users, (u) => dateKey(u.createdAt).slice(0, 7));
  const before = users.filter((u) => dateKey(u.createdAt).slice(0, 7) < monthKeys[0]).length;
  let running = before;

  const destCounts = countBy(liveB, (b) => destOf(b).name);
  const statusCount = (arr, key) => arr.filter((x) => x.status === key).length;

  const charts = {
    bookingsOverTime: days.map((d) => ({ date: d, value: bPerDay.get(d) || 0 })),
    revenueOverTime: days.map((d) => ({ date: d, value: revPerDay.get(d) || 0 })),
    bookingsByDestination: [...destCounts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    paymentStatus: ["paid", "pending", "failed", "cancelled", "refunded"].map((s) => ({ name: s, value: statusCount(payments, s) })),
    bookingStatus: ["confirmed", "pending", "cancelled"].map((s) => ({ name: s, value: statusCount(bookings, s) })),
    userGrowth: monthKeys.map((m) => { const added = usersPerMonth.get(m) || 0; running += added; return { month: m, added, total: running }; }),
  };

  return { kpis, pulse, charts };
}

/** Trending = bookings (not cancelled) in the last `window` days vs the `window` before. */
function buildTrending({ bookings, destOf, destinations, packages, hotels, now = new Date(), window = 30 }) {
  const today = dateKey(now);
  const curFrom = addDays(today, -(window - 1));
  const prevFrom = addDays(today, -(2 * window - 1));
  const prevTo = addDays(curFrom, -1);
  const liveB = bookings.filter(live);
  const cur = liveB.filter((b) => inRange(dateKey(b.createdAt), curFrom, today));
  const prev = liveB.filter((b) => inRange(dateKey(b.createdAt), prevFrom, prevTo));

  const rank = (list, prevList, keyFn, meta) => {
    const c = countBy(list, keyFn), p = countBy(prevList, keyFn);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n], i) => ({
      rank: i + 1, ...meta(k), bookings: n, previous: p.get(k) || 0, change: pct(n, p.get(k) || 0),
    }));
  };
  const destMeta = (name) => { const d = destinations.find((x) => x.name === name); return { id: d ? d.slug : "", name, isFeatured: !!(d && d.isFeatured), type: "destination" }; };
  const pkgMeta = (id) => { const p = packages.find((x) => x.id === id); return { id, name: p ? p.title : id, isFeatured: !!(p && p.isFeatured), type: "package" }; };
  const hotelMeta = (id) => { const h = hotels.find((x) => x.id === id); return { id, name: h ? h.name : id, isFeatured: !!(h && h.isFeatured), type: "hotel" }; };

  return {
    windowDays: window,
    totalRecent: cur.length,
    destinations: rank(cur, prev, (b) => destOf(b).name, destMeta),
    packages: rank(cur.filter((b) => b.itemType === "package"), prev.filter((b) => b.itemType === "package"), (b) => b.itemId, pkgMeta),
    hotels: rank(cur.filter((b) => b.itemType === "hotel"), prev.filter((b) => b.itemType === "hotel"), (b) => b.itemId, hotelMeta),
  };
}

module.exports = { buildDashboard, buildTrending, countBy, top, pct, lastDays, createdBetween, MONTHS, live };
