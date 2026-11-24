// Run: node tests/routes.test.js  — checks the ONE Express app for duplicate / conflicting route registrations (no database needed).
process.env.JWT_SECRET = "test-secret";
const assert = require("assert");
const createApp = require("../app");

const app = createApp();
const seen = new Map();
function walk(stack, prefix) {
  for (const layer of stack) {
    if (layer.route) {
      for (const m of Object.keys(layer.route.methods)) {
        const key = (m.toUpperCase() + " " + prefix + layer.route.path).replace(/(.)\/$/, "$1");
        seen.set(key, (seen.get(key) || 0) + 1);
      }
    } else if (layer.name === "router" && layer.handle.stack) {
      const src = layer.regexp.source.replace("^\\", "").replace("\\/?(?=\\/|$)", "").replace(/\\\//g, "/");
      walk(layer.handle.stack, prefix + src);
    }
  }
}
walk(app._router.stack, "");
if (process.env.DEBUG_ROUTES) console.log([...seen.keys()].join("\n"));
const dups = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
assert.deepStrictEqual(dups, [], "duplicate route registrations: " + dups.join(", "));
const must = ["POST /api/auth/login", "POST /api/bookings/:id/pay", "POST /api/payments/demo", "POST /api/payments/order", "POST /api/payments/verify", "POST /api/payments/webhook",
  "GET /api/reviews", "POST /api/reviews", "GET /api/admin/dashboard", "GET /api/admin/payments", "PATCH /api/admin/reviews/:id", "GET /api/catalog", "POST /api/contact"];
for (const r of must) assert.ok(seen.has(r), "missing route: " + r);
console.log(`Route table OK ✔ (${seen.size} routes, no duplicates)`);
