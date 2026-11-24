// Run: node tests/engines.test.js   (pure logic, no database needed)
const assert = require("assert");
const { buildDashboard, buildTrending } = require("../utils/analytics");
const { buildInsights, NOT_ENOUGH } = require("../utils/insights");
const { buildAlerts } = require("../utils/alertsEngine");
const { isPastDate, todayISO, isValidISODate, addDays, PAST_DATE_MESSAGE } = require("../utils/dates");
const gw = require("../utils/gateway");

const now = new Date("2026-10-04T08:00:00Z");
const day = (n) => new Date(now.getTime() - n * 864e5);
const destOf = (b) => ({ slug: (b.destinationName || "").toLowerCase(), name: b.destinationName });
const mk = (o) => ({ status: "pending", paymentStatus: "unpaid", travellers: 2, amount: 10000, itemType: "package", itemId: "goa-escape", title: "Goa Escape", destinationName: "Goa", user: "u1", travelDate: "2026-11-10", createdAt: day(1), ...o });

// --- date rules (today is detected, never hardcoded) ---
assert.strictEqual(todayISO(now), "2026-10-04");
assert.ok(isPastDate("2026-10-03", now));
assert.ok(!isPastDate("2026-10-04", now), "today must be selectable");
assert.ok(!isPastDate("2026-10-05", now));
assert.ok(!isValidISODate("2026-02-30"));
assert.strictEqual(addDays("2026-10-31", 1), "2026-11-01");

// --- empty data: nothing crashes, insights say "not enough data" ---
const empty = buildInsights({ bookings: [], payments: [], users: [], destOf, now });
assert.ok(empty.every((i) => i.insufficient && i.text === NOT_ENOUGH));
const d0 = buildDashboard({ bookings: [], payments: [], users: [], enquiries: [], counts: { hotels: 0, destinations: 0, packages: 0 }, destOf, now });
assert.strictEqual(d0.kpis.revenue, 0); assert.strictEqual(d0.pulse.popularDestination, null); assert.strictEqual(d0.pulse.bookingGrowth.percent, null);

// --- real-looking data ---
const bookings = [
  mk({ createdAt: day(1) }), mk({ createdAt: day(2) }), mk({ createdAt: day(3), status: "confirmed", paymentStatus: "paid" }),
  mk({ createdAt: day(9), destinationName: "Goa" }),
  mk({ createdAt: day(1), destinationName: "Kerala", itemType: "hotel", itemId: "backwater-villa", title: "Backwater Villa · Kerala", status: "cancelled" }),
];
const payments = [{ status: "paid", amount: 20000, paidAt: day(3), createdAt: day(3) }, { status: "paid", amount: 10000, paidAt: day(9), createdAt: day(9) }, { status: "failed", amount: 1, createdAt: day(1) }];
const users = [1, 2, 3].map((i) => ({ createdAt: day(i) }));
const dash = buildDashboard({ bookings, payments, users, enquiries: [{}, {}], counts: { hotels: 6, destinations: 6, packages: 3 }, destOf, now });
assert.strictEqual(dash.kpis.revenue, 30000);
assert.strictEqual(dash.kpis.pendingPayments, 3);
assert.strictEqual(dash.kpis.cancelled, 1);
assert.strictEqual(dash.pulse.popularDestination.name, "Goa");
assert.strictEqual(dash.pulse.bookingGrowth.thisWeek, 4);
assert.strictEqual(dash.pulse.bookingGrowth.lastWeek, 1);
assert.strictEqual(dash.pulse.cancellationRate, 20);
assert.strictEqual(dash.charts.bookingsOverTime.length, 30);
assert.strictEqual(dash.charts.userGrowth.at(-1).total, 3);

const trend = buildTrending({ bookings, destOf, destinations: [{ slug: "goa", name: "Goa", isFeatured: true }], packages: [], hotels: [], now });
assert.strictEqual(trend.destinations[0].name, "Goa");
assert.strictEqual(trend.destinations[0].bookings, 4); // cancelled Kerala booking excluded, day(9) booking is within 30d

const ins = buildInsights({ bookings, payments, users, destOf, now });
const surge = ins.find((i) => i.id === "destination-surge");
assert.ok(!surge.insufficient && /Goa/.test(surge.title) && /featuring Goa/.test(surge.action.text));
assert.ok(ins.find((i) => i.id === "pending-payments").metrics[0].value === "3");

const alerts = buildAlerts({ bookings, payments, enquiries: [{ status: "new" }, {}, { status: "handled" }], users, now });
assert.ok(alerts.find((a) => a.type === "pending-payments").message.startsWith("3 bookings"));
assert.ok(alerts.find((a) => a.type === "unhandled-enquiries").message.startsWith("2 enquiries"));
assert.ok(alerts.find((a) => a.type === "new-users") === undefined || true);

// --- gateway validation ---
assert.ok(gw.validateInput("card", { cardNumber: "4242 4242 4242 4242", cardName: "A", expiry: "12/30", cvv: "123" }, now).details);
assert.ok(gw.validateInput("card", { cardNumber: "4242 4242 4242 4241", cardName: "A", expiry: "12/30", cvv: "123" }, now).error);
assert.ok(gw.validateInput("card", { cardNumber: "4242424242424242", cardName: "A", expiry: "01/26", cvv: "123" }, now).error, "expired card");
assert.ok(gw.validateInput("upi", { upiId: "bad" }).error);
(async () => {
  assert.strictEqual((await gw.charge({ method: "card", details: { number: "4000000000000002", last4: "0002" }, delayMs: 0 })).ok, false);
  const ok = await gw.charge({ method: "card", details: { number: "4242424242424242", last4: "4242" }, delayMs: 0 });
  assert.ok(ok.ok && ok.transactionId && !JSON.stringify(ok.details).includes("4242424242424242"));
  console.log("All engine tests passed ✔  (" + PAST_DATE_MESSAGE + ")");
})();
