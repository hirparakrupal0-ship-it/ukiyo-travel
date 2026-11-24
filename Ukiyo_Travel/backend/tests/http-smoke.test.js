// Run: node tests/http-smoke.test.js  — HTTP-layer checks that need no database.
process.env.JWT_SECRET = "test-secret"; process.env.MONGO_URI = "mongodb://127.0.0.1:1/none";
const assert = require("assert"); const http = require("http"); const jwt = require("jsonwebtoken");
const express = require("express");
const { notFound, errorHandler } = require("../middleware/errorMiddleware");
const app = express(); app.use(express.json());
app.get("/api/health", (req, res) => res.json({ success: true, today: require("../utils/dates").todayISO() }));
app.use("/api/admin", require("../routes/adminRoutes")); app.use("/api/bookings", require("../routes/bookingRoutes"));
app.use("/api/catalog", require("../routes/catalogRoutes")); app.use("/api/reviews", require("../routes/reviewRoutes"));
app.use(notFound); app.use(errorHandler);
const srv = app.listen(0, async () => {
  const port = srv.address().port;
  const req = (path, { method = "GET", token } = {}) => new Promise((ok) => { const r = http.request({ port, path, method, headers: token ? { Authorization: "Bearer " + token } : {} }, (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => ok({ status: res.statusCode, body: b })); }); r.end(); });
  const adminPaths = ["/api/admin/dashboard", "/api/admin/payments", "/api/admin/users", "/api/admin/calendar?month=2026-10", "/api/admin/alerts", "/api/admin/catalog/hotels", "/api/admin/reviews", "/api/admin/insights", "/api/admin/trending"];
  for (const p of adminPaths) {
    assert.strictEqual((await req(p)).status, 401, "no token -> 401: " + p);
    assert.strictEqual((await req(p, { token: "garbage" })).status, 401, "bad token -> 401: " + p);
    assert.strictEqual((await req(p, { token: jwt.sign({ id: "x" }, "wrong-secret") })).status, 401, "forged token -> 401: " + p);
  }
  for (const [p, m] of [["/api/bookings", "GET"], ["/api/bookings", "POST"], ["/api/bookings/abc/pay", "POST"], ["/api/reviews", "POST"]]) assert.strictEqual((await req(p, { method: m })).status, 401, "user routes need a token: " + p);
  const h = JSON.parse((await req("/api/health")).body); assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(h.today));
  assert.strictEqual((await req("/api/nope")).status, 404);
  console.log("HTTP smoke tests passed ✔ (" + adminPaths.length + " admin routes reject missing/invalid/forged tokens)");
  srv.close(); process.exit(0);
});
