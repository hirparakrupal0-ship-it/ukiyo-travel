/* =========================================================
   End-to-end API test against a REAL MongoDB.
     MONGO_URI=mongodb://127.0.0.1:27017/ukiyo_travel_test node tests/integration.test.js
   The database name MUST end in "_test": it is wiped at the start.
========================================================= */
process.env.JWT_SECRET = "integration-test-secret";
process.env.NODE_ENV = "test";
process.env.DEMO_PAYMENTS = "true";
process.env.AUTH_RATE_LIMIT_MAX = "1000"; process.env.PAY_RATE_LIMIT_MAX = "1000";
const crypto = require("crypto");
const assert = require("assert");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const createApp = require("../app");
const razor = require("../config/razorpay");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const { ensureSeeded } = require("../utils/catalog");
const { syncLegacyData } = require("../utils/legacySync");
const gateway = require("../utils/gateway");

const URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ukiyo_travel_test";
if (!/_test$/.test(URI.split("?")[0])) { console.error("Refusing to run: database name must end with _test"); process.exit(1); }

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log("  ✔", msg); };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`); passed++; console.log("  ✔", msg); };
const section = (t) => console.log("\n" + t);
const future = (days) => new Date(Date.now() + days * 864e5 + 5.5 * 3600e3).toISOString().slice(0, 10);

(async () => {
  await connectDB(URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Booking, Payment, Review].map((m) => m.init()));
  await ensureSeeded();
  const srv = createApp().listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, path, { token, body, headers = {}, raw } = {}) => {
    const res = await fetch(base + path, { method, headers: { ...(body && !raw ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}), ...headers }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch (_) {}
    return { status: res.status, body: json, headers: res.headers };
  };

  section("1. Service + MongoDB connectivity");
  let r = await call("GET", "/api/health");
  ok(r.status === 200 && r.body.db === "connected", "health reports MongoDB connected");
  r = await call("GET", "/api/catalog");
  ok(r.body.destinations.length === 6 && r.body.packages.length === 3 && r.body.hotels.length === 6, "catalog seeded from the backend seed file (6/3/6)");

  section("2. Registration, login, roles");
  r = await call("POST", "/api/auth/register", { body: { firstName: "Asha", lastName: "Rao", email: "asha@example.com", password: "secret123", role: "admin" } });
  ok(r.status === 201 && r.body.user.role === "user", "register works and ignores a role:'admin' in the body");
  const asha = r.body.token;
  r = await call("POST", "/api/auth/register", { body: { firstName: "Asha", lastName: "Rao", email: "asha@example.com", password: "secret123" } });
  eq(r.status, 409, "duplicate email is rejected");
  r = await call("POST", "/api/auth/login", { body: { email: "asha@example.com", password: "wrong" } });
  eq(r.status, 401, "wrong password -> 401");
  r = await call("POST", "/api/auth/login", { body: { email: "asha@example.com", password: "secret123" } });
  ok(r.status === 200 && r.body.token, "user login works");
  r = await call("GET", "/api/auth/me", { token: asha });
  eq(r.body.user.email, "asha@example.com", "token validation (/me)");
  r = await call("GET", "/api/auth/me", { token: "junk" });
  eq(r.status, 401, "invalid token -> 401");
  await User.create({ firstName: "Root", lastName: "Admin", email: "admin@example.com", password: "adminpass1", role: "admin" });
  r = await call("POST", "/api/auth/login", { body: { email: "admin@example.com", password: "adminpass1", portal: "admin" } });
  ok(r.status === 200 && r.body.user.role === "admin", "admin login via admin portal works");
  const admin = r.body.token;
  r = await call("POST", "/api/auth/login", { body: { email: "asha@example.com", password: "secret123", portal: "admin" } });
  eq(r.status, 403, "regular user is refused by the admin portal login");

  section("3. Authorization (user vs admin APIs)");
  for (const p of ["/api/admin/dashboard", "/api/admin/payments", "/api/admin/reviews", "/api/admin/users", "/api/admin/bookings", "/api/admin/catalog/hotels"]) {
    eq((await call("GET", p)).status, 401, `no token -> 401 ${p}`);
    eq((await call("GET", p, { token: asha })).status, 403, `regular user -> 403 ${p}`);
    eq((await call("GET", p, { token: admin })).status, 200, `admin -> 200 ${p}`);
  }
  eq((await call("PATCH", "/api/admin/reviews/abc", { token: asha, body: { status: "approved" } })).status, 403, "user cannot moderate reviews");
  r = await call("OPTIONS", "/api/catalog", { headers: { Origin: "http://localhost:3001", "Access-Control-Request-Method": "GET" } });
  eq(r.headers.get("access-control-allow-origin"), "http://localhost:3001", "CORS allows the Admin Panel origin");
  r = await call("OPTIONS", "/api/catalog", { headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET" } });
  eq(r.headers.get("access-control-allow-origin"), "http://localhost:3000", "CORS allows the User Panel origin");
  r = await call("OPTIONS", "/api/catalog", { headers: { Origin: "http://evil.example", "Access-Control-Request-Method": "GET" } });
  ok(!r.headers.get("access-control-allow-origin"), "CORS does not allow other origins");

  section("4. Booking creation");
  const goa = { itemType: "destination", itemId: "goa", travellers: 2 };
  r = await call("POST", "/api/bookings", { token: asha, body: { ...goa, travelDate: "2020-01-01" } });
  ok(r.status === 400 && /today or a future/i.test(r.body.message), "past travel date rejected");
  r = await call("POST", "/api/bookings", { token: asha, body: { ...goa, travelDate: future(10), price: "₹1", title: "hacked" } });
  ok(r.status === 201 && r.body.booking.status === "pending" && r.body.booking.amount === 19998, "booking created Pending Payment; price comes from the catalog (₹9,999 x 2), not the browser");
  const b1 = r.body.booking._id;
  eq((await call("POST", "/api/bookings", { body: goa })).status, 401, "booking needs login");

  section("5. Payments (sandbox gateway)");
  r = await call("GET", "/api/payments/config", { token: asha });
  ok(r.body.mode === "demo" && r.body.enabled, "payment config reports sandbox mode");
  r = await call("POST", "/api/payments/demo", { token: asha, body: { bookingId: b1, method: "card", card: { number: "4242 4242 4242 4241", name: "A R", expiry: "12/39", cvv: "123" } } });
  ok(r.status === 400 && r.body.code === "INVALID_DETAILS", "malformed card -> 400, nothing recorded");
  eq(await Payment.countDocuments({ booking: b1, status: { $in: ["failed", "paid"] } }), 0, "no failed/paid record for invalid input");
  r = await call("POST", "/api/payments/demo", { token: asha, body: { bookingId: b1, method: "card", card: { number: "4000 0000 0000 0002", name: "A R", expiry: "12/39", cvv: "123" } } });
  ok(r.status === 402 && r.body.code === "DECLINED", "declined card -> 402 DECLINED");
  let bk = await Booking.findById(b1);
  ok(bk.status === "pending" && bk.paymentStatus === "failed" && !bk.reference, "after failure the booking stays Pending Payment (payment failed), no reference");
  eq((await Payment.find({ booking: b1, status: "failed" })).length, 1, "one FAILED payment record");
  // two simultaneous submits of a good payment: exactly one wins
  const good = { bookingId: b1, method: "upi", upiId: "asha@okbank" };
  const [p1, p2] = await Promise.all([call("POST", "/api/payments/demo", { token: asha, body: good }), call("POST", "/api/payments/demo", { token: asha, body: good })]);
  eq([p1.status, p2.status].sort(), [200, 409], "double-submit: one success, one 409");
  bk = await Booking.findById(b1);
  ok(bk.status === "confirmed" && bk.paymentStatus === "paid" && /^UKY-\d{4}-[A-Z0-9]{5}$/.test(bk.reference), "booking Confirmed with reference " + bk.reference);
  eq(await Payment.countDocuments({ booking: b1, status: "paid" }), 1, "exactly ONE paid payment for the booking (no double counting)");
  r = await call("POST", "/api/payments/demo", { token: asha, body: good });
  eq(r.status, 409, "paying an already-paid booking is refused");
  const other = await call("POST", "/api/auth/register", { body: { firstName: "Ben", lastName: "K", email: "ben@example.com", password: "secret123" } });
  r = await call("POST", "/api/payments/demo", { token: other.body.token, body: good });
  eq(r.status, 404, "another user cannot pay for / see my booking");
  r = await call("GET", "/api/bookings", { token: asha });
  ok(r.body.bookings[0].bookingRef === bk.reference && r.body.bookings[0].paymentNote === "UPI" && r.body.bookings[0].paymentMethod === "upi", "My Trips shape has reference + receipt fields");

  section("6. Command Center payment contract (/api/bookings/:id/pay)");
  r = await call("POST", "/api/bookings", { token: asha, body: { itemType: "package", itemId: "kerala-backwaters", travellers: 1, travelDate: future(20) } });
  const pk = (await call("GET", "/api/catalog")).body.packages;
  if (r.status !== 201) { r = await call("POST", "/api/bookings", { token: asha, body: { itemType: "package", itemId: pk[0].id, travellers: 1, travelDate: future(20) } }); }
  ok(r.status === 201, "package booking created");
  const b2 = r.body.booking._id;
  r = await call("POST", `/api/bookings/${b2}/pay`, { token: asha, body: { method: "upi", upiId: "test@fail" } });
  ok(r.status === 200 && r.body.outcome === "failed" && r.body.booking.canRetry, "UPI id containing 'fail' -> outcome failed, can retry");
  r = await call("POST", `/api/bookings/${b2}/pay`, { token: asha, body: { method: "card", cardNumber: "4242424242424242", cardName: "Asha", expiry: "12/39", cvv: "123" } });
  ok(r.status === 200 && r.body.outcome === "paid" && r.body.booking.status === "confirmed", "retry succeeds -> paid + confirmed");
  eq(await Payment.countDocuments({ booking: b2 }), 2, "attempts kept: 1 failed + 1 paid");

  section("7. Reviews: submit -> moderate -> public display");
  r = await call("POST", "/api/bookings", { token: asha, body: { itemType: "hotel", itemId: "none", travellers: 1, travelDate: future(5) } });
  ok(r.status === 404, "unknown catalog item rejected");
  const hotel = (await call("GET", "/api/catalog")).body.hotels[0];
  r = await call("POST", "/api/bookings", { token: asha, body: { itemType: "hotel", itemId: hotel.id, travellers: 1, travelDate: future(6) } });
  const b3 = r.body.booking._id;
  r = await call("POST", "/api/reviews", { token: asha, body: { bookingId: b3, rating: 5, comment: "x" } });
  eq(r.status, 400, "cannot review an unpaid booking");
  r = await call("POST", "/api/reviews", { token: asha, body: { bookingId: b1, rating: 9 } });
  eq(r.status, 400, "rating must be 1-5");
  r = await call("POST", "/api/reviews", { token: other.body.token, body: { bookingId: b1, rating: 5 } });
  eq(r.status, 404, "cannot review someone else's booking");
  r = await call("POST", "/api/reviews", { token: asha, body: { bookingId: b1, rating: 5, comment: "Loved Goa!" } });
  ok(r.status === 201 && r.body.review.status === "pending", "review stored as PENDING");
  eq((await call("POST", "/api/reviews", { token: asha, body: { bookingId: b1, rating: 4 } })).status, 409, "one review per booking");
  r = await call("GET", "/api/reviews");
  eq(r.body.count, 0, "pending review is NOT public");
  r = await call("GET", "/api/admin/reviews?status=pending", { token: admin });
  ok(r.body.count === 1 && r.body.summary.pending === 1 && r.body.summary.count === 0, "admin sees it in Pending; approved count is 0");
  const rid = r.body.reviews[0]._id;
  r = await call("PATCH", `/api/admin/reviews/${rid}`, { token: admin, body: { status: "approved" } });
  eq(r.status, 200, "admin approves");
  r = await call("GET", "/api/reviews?itemType=destination&itemId=goa");
  ok(r.body.count === 1 && r.body.average === 5 && r.body.reviews[0].comment === "Loved Goa!" && r.body.reviews[0].author === "Asha R.", "approved review is public with correct count/average");
  // second review (rating 2) on b2, rejected; third approved on same destination
  await call("POST", "/api/reviews", { token: asha, body: { bookingId: b2, rating: 2, comment: "meh" } });
  const rv2 = await Review.findOne({ booking: b2 });
  r = await call("PATCH", `/api/admin/reviews/${rv2._id}`, { token: admin, body: { status: "rejected" } });
  r = await call("GET", "/api/reviews");
  eq(r.body.count, 1, "rejected review stays hidden");
  await call("PATCH", `/api/admin/reviews/${rv2._id}`, { token: admin, body: { status: "approved" } });
  r = await call("GET", "/api/reviews");
  ok(r.body.count === 2 && r.body.average === 3.5, "average of approved reviews (5 and 2) = 3.5, count 2");
  r = await call("GET", "/api/catalog");
  const goaCat = r.body.destinations.find((d) => d.slug === "goa");
  ok(goaCat.reviewCount === 1 && goaCat.reviewAverage === 5, "catalog destination card carries approved count/average");
  r = await call("GET", "/api/admin/reviews", { token: admin });
  ok(r.body.summary.average === 3.5 && r.body.summary.count === 2 && r.body.summary.pending === 0, "admin summary matches");

  section("8. Admin dashboard reflects verified payments");
  r = await call("GET", "/api/admin/dashboard", { token: admin });
  const paidSum = (await Payment.find({ status: "paid" })).reduce((s, p) => s + p.amount, 0);
  ok(r.body.kpis.revenue === paidSum && paidSum > 0, `dashboard revenue (₹${paidSum}) = sum of paid payments`);
  eq(r.body.kpis.bookings, 3, "dashboard booking total");
  eq(r.body.kpis.confirmed, 2, "confirmed count");
  eq(r.body.kpis.pendingPayments, 1, "pending payments count");
  r = await call("GET", "/api/admin/payments", { token: admin });
  ok(r.body.summary.collected === paidSum && r.body.summary.failed === 2 && r.body.summary.paid === 2, "payments page summary (2 paid, 2 failed)");
  r = await call("GET", "/api/admin/stats", { token: admin });
  eq(r.body.stats.revenue, paidSum, "legacy /stats revenue also uses verified payments");
  r = await call("GET", "/api/admin/bookings", { token: admin });
  ok(r.body.count === 3, "admin lists all bookings");

  section("9. Booking management, cancellation, refunds");
  r = await call("PATCH", `/api/admin/bookings/${b3}`, { token: admin, body: { status: "confirmed" } });
  eq(r.status, 400, "admin cannot confirm an unpaid booking");
  const pay1 = await Payment.findOne({ booking: b1, status: "paid" });
  r = await call("POST", `/api/admin/payments/${pay1._id}/refund`, { token: admin });
  eq(r.status, 200, "admin refund succeeds");
  bk = await Booking.findById(b1);
  ok(bk.status === "cancelled" && bk.paymentStatus === "refunded", "refund cancels booking + marks refunded");
  r = await call("GET", "/api/admin/dashboard", { token: admin });
  eq(r.body.kpis.revenue, paidSum - pay1.amount, "refunded amount leaves revenue");
  r = await call("DELETE", `/api/bookings/${b3}`, { token: asha });
  ok(r.status === 200, "user cancels an unpaid booking");
  eq(await Payment.countDocuments({ booking: b3, status: "pending" }), 0, "no payment left pending for a cancelled booking");
  r = await call("POST", `/api/bookings/${b3}/pay`, { token: asha, body: { method: "upi", upiId: "a@b" } });
  eq(r.status, 400, "cancelled booking cannot be paid");
  r = await call("DELETE", `/api/bookings/${b2}`, { token: asha });
  ok(r.status === 200 && /refunded/i.test(r.body.message), "user cancelling a paid booking refunds it");
  eq(await Payment.countDocuments({ status: "refunded" }), 2, "two refunded payment records");

  section("10. Razorpay mode (fake gateway client; signature logic is real)");
  process.env.RAZORPAY_KEY_ID = "rzp_test_x"; process.env.RAZORPAY_KEY_SECRET = "shh-secret"; process.env.RAZORPAY_WEBHOOK_SECRET = "hook-secret";
  let refunds = [];
  razor._setInstanceForTests({ orders: { create: async (o) => ({ id: "order_" + o.receipt.slice(-6), amount: o.amount, currency: o.currency }) }, payments: { refund: async (id, o) => { refunds.push([id, o.amount]); return { id: "rfnd_1" }; } } });
  r = await call("GET", "/api/payments/config", { token: asha });
  ok(r.body.mode === "razorpay" && r.body.keyId === "rzp_test_x" && !JSON.stringify(r.body).includes("shh-secret"), "config switches to razorpay and never exposes the secret");
  r = await call("POST", "/api/bookings", { token: asha, body: { itemType: "destination", itemId: "kerala", travellers: 1, travelDate: future(30) } });
  const b4 = r.body.booking._id;
  r = await call("POST", "/api/payments/demo", { token: asha, body: { bookingId: b4, method: "upi", upiId: "a@b" } });
  eq(r.status, 503, "sandbox endpoint is DISABLED while Razorpay is configured");
  r = await call("POST", `/api/bookings/${b4}/pay`, { token: asha, body: { method: "upi", upiId: "a@b" } });
  eq(r.status, 503, "sandbox /pay is DISABLED too");
  r = await call("POST", "/api/payments/order", { token: asha, body: { bookingId: b4 } });
  ok(r.status === 200 && r.body.orderId && r.body.amount === 1199900, "order created (amount in paise): " + r.body.amount);
  const orderId = r.body.orderId;
  const sig = (o, p, s = "shh-secret") => crypto.createHmac("sha256", s).update(`${o}|${p}`).digest("hex");
  r = await call("POST", "/api/payments/verify", { token: asha, body: { bookingId: b4, razorpay_order_id: orderId, razorpay_payment_id: "pay_AAA", razorpay_signature: "bad", method: "upi" } });
  ok(r.status === 400 && r.body.code === "DECLINED", "forged signature rejected");
  bk = await Booking.findById(b4);
  ok(bk.status === "pending" && bk.paymentStatus === "failed", "booking not confirmed after a bad signature");
  r = await call("POST", "/api/payments/order", { token: asha, body: { bookingId: b4 } });
  const order2 = r.body.orderId;
  r = await call("POST", "/api/payments/verify", { token: asha, body: { bookingId: b4, razorpay_order_id: order2, razorpay_payment_id: "pay_BBB", razorpay_signature: sig(order2, "pay_BBB"), method: "upi" } });
  ok(r.status === 200 && r.body.booking.status === "confirmed", "valid signature confirms the booking");
  r = await call("POST", "/api/payments/verify", { token: asha, body: { bookingId: b4, razorpay_order_id: order2, razorpay_payment_id: "pay_BBB", razorpay_signature: sig(order2, "pay_BBB"), method: "upi" } });
  ok(r.status === 200 && /already/i.test(r.body.message), "replaying verify is idempotent");
  eq(await Payment.countDocuments({ booking: b4, status: "paid" }), 1, "still exactly one paid payment");
  r = await call("POST", "/api/payments/verify", { token: other.body.token, body: { bookingId: b4, razorpay_order_id: order2, razorpay_payment_id: "pay_BBB", razorpay_signature: sig(order2, "pay_BBB") } });
  eq(r.status, 404, "another user cannot verify my payment");
  // webhook path: customer closed the browser
  r = await call("POST", "/api/bookings", { token: asha, body: { itemType: "destination", itemId: "goa", travellers: 1, travelDate: future(31) } });
  const b5 = r.body.booking._id;
  r = await call("POST", "/api/payments/order", { token: asha, body: { bookingId: b5 } });
  const order3 = r.body.orderId;
  const evt = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_CCC", order_id: order3, method: "card" } } } });
  r = await call("POST", "/api/payments/webhook", { raw: evt, headers: { "Content-Type": "application/json", "x-razorpay-signature": "nope" } });
  eq(r.status, 400, "webhook with a bad signature rejected");
  const wsig = crypto.createHmac("sha256", "hook-secret").update(evt).digest("hex");
  r = await call("POST", "/api/payments/webhook", { raw: evt, headers: { "Content-Type": "application/json", "x-razorpay-signature": wsig } });
  eq(r.status, 200, "signed webhook accepted");
  await call("POST", "/api/payments/webhook", { raw: evt, headers: { "Content-Type": "application/json", "x-razorpay-signature": wsig } });
  bk = await Booking.findById(b5);
  ok(bk.status === "confirmed" && (await Payment.countDocuments({ booking: b5, status: "paid" })) === 1, "webhook confirmed the booking once (replay did not duplicate)");
  // admin refund uses the gateway
  const rp = await Payment.findOne({ booking: b4, status: "paid" });
  r = await call("POST", `/api/admin/payments/${rp._id}/refund`, { token: admin });
  ok(r.status === 200 && refunds.length === 1 && refunds[0][0] === "pay_BBB", "refund of a Razorpay payment calls the gateway with the Razorpay payment id");
  razor._setInstanceForTests({ payments: { refund: async () => { throw new Error("boom"); } } });
  const rp5 = await Payment.findOne({ booking: b5, status: "paid" });
  r = await call("POST", `/api/admin/payments/${rp5._id}/refund`, { token: admin });
  bk = await Booking.findById(b5);
  ok(r.status === 502 && bk.status === "confirmed" && (await Payment.findById(rp5._id)).status === "paid", "gateway refund failure -> 502 and nothing changes");
  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; razor._setInstanceForTests(null);

  section("11. Legacy data from the Smart project");
  const legacyUser = await User.findOne({ email: "ben@example.com" });
  await Booking.collection.insertOne({ user: legacyUser._id, itemType: "destination", itemId: "goa", title: "Goa", price: "₹9,999", travelDate: future(40), travellers: 2, notes: "", status: "confirmed", amount: 19998, paymentStatus: "paid", bookingRef: "UKY-2026-A82F9", paymentMethod: "card", paymentNote: "Card •••• 4242", transactionId: "TXNLEGACY1", razorpayPaymentId: "pay_LEGACY", paidAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  await Review.collection.insertOne({ user: legacyUser._id, booking: new mongoose.Types.ObjectId(), itemType: "hotel", itemId: "x", rating: 3, comment: "", status: "hidden", createdAt: new Date(), updatedAt: new Date() });
  const before = (await call("GET", "/api/admin/dashboard", { token: admin })).body.kpis.revenue;
  const sync = await syncLegacyData({ apply: true });
  ok(sync.counts.references === 1 && sync.counts.paidPayments === 1 && sync.counts.reviews === 1, "sync converted 1 reference, 1 paid payment, 1 hidden review");
  const after = (await call("GET", "/api/admin/dashboard", { token: admin })).body.kpis.revenue;
  eq(after - before, 19998, "legacy paid booking now counts in revenue");
  eq((await syncLegacyData({ apply: true })).changed, false, "sync is idempotent");
  r = await call("GET", "/api/bookings", { token: (await call("POST", "/api/auth/login", { body: { email: "ben@example.com", password: "secret123" } })).body.token });
  ok(r.body.bookings[0].reference === "UKY-2026-A82F9" && r.body.bookings[0].bookingRef === "UKY-2026-A82F9", "legacy booking readable with its reference");

  section("12. Users, enquiries, deactivation");
  r = await call("POST", "/api/contact", { body: { name: "Visitor", email: "v@example.com", message: "Hi" } });
  eq(r.status, 201, "public enquiry accepted");
  r = await call("GET", "/api/admin/enquiries", { token: admin });
  eq(r.body.count, 1, "admin sees the enquiry");
  r = await call("GET", "/api/admin/users", { token: admin });
  const u = r.body.users.find((x) => x.email === "asha@example.com");
  r = await call("PATCH", `/api/admin/users/${u.id}/active`, { token: admin, body: { isActive: false } });
  eq(r.status, 200, "admin deactivates a user");
  eq((await call("GET", "/api/bookings", { token: asha })).status, 403, "deactivated user's token stops working");
  eq((await call("POST", "/api/auth/login", { body: { email: "asha@example.com", password: "secret123" } })).status, 403, "deactivated user cannot log in");
  eq((await call("GET", "/api/nope")).status, 404, "unknown route -> JSON 404");

  console.log(`\nAll ${passed} integration checks passed ✔`);
  srv.close(); await mongoose.connection.close(); process.exit(0);
})().catch(async (e) => { console.error("\n✖ FAILED:", e.message); console.error(e.stack.split("\n").slice(1, 4).join("\n")); try { await mongoose.connection.close(); } catch (_) {} process.exit(1); });
