require("./config/env");
const connectDB = require("./config/db");
const createApp = require("./app");
const { ensureSeeded } = require("./utils/catalog");
const { syncLegacyData } = require("./utils/legacySync");

const PORT = parseInt(process.env.PORT, 10) || 5000;
const placeholder = !process.env.JWT_SECRET || process.env.JWT_SECRET === "replace_this_with_a_long_random_secret";

if (!process.env.JWT_SECRET) { console.error("✖ JWT_SECRET is not set. Copy .env.example to .env and set it."); process.exit(1); }
if (placeholder) {
  if (process.env.NODE_ENV === "production") { console.error("✖ Refusing to start in production with the placeholder JWT_SECRET."); process.exit(1); }
  console.warn("⚠ JWT_SECRET is still the placeholder — set a long random value in .env before deploying.");
}

(async () => {
  try {
    const conn = await connectDB();
    console.log(`✔ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`✖ MongoDB connection error: ${err.message}`);
    process.exit(1);
  }

  try {
    const seeded = await ensureSeeded(); // fills EMPTY catalog collections only; never overwrites admin edits
    if (seeded.destinations || seeded.packages || seeded.hotels) console.log("✔ Catalog seeded:", seeded);
    if (String(process.env.AUTO_MIGRATE || "true").toLowerCase() !== "false") {
      const r = await syncLegacyData({ apply: true });
      if (r.changed) console.log("✔ Legacy data brought up to date:", r.counts);
    }
  } catch (e) {
    console.warn("Startup data check failed:", e.message);
  }

  const server = createApp().listen(PORT, () => console.log(`✔ Ukiyo Travel API running on http://localhost:${PORT}`));
  server.on("error", (e) => {
    console.error(e.code === "EADDRINUSE" ? `✖ Port ${PORT} is already in use. Set a different PORT in .env (and API_URL for the panels).` : `✖ ${e.message}`);
    process.exit(1);
  });
  const stop = () => server.close(() => require("mongoose").connection.close().finally(() => process.exit(0)));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})();
