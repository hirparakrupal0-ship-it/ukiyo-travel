const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const catalogRoutes = require("./routes/catalogRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { webhook } = require("./controllers/paymentController");
const { authLimiter } = require("./middleware/rateLimiters");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { todayISO } = require("./utils/dates");

/** The ONE Express application shared by the User Panel and the Admin Panel. */
function createApp() {
  const app = express();
  app.disable("x-powered-by");

  // CORS: only the configured panel origins may call the API from a browser ("*" allowed for local hacking).
  const defaults = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"];
  const origins = (process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",") : defaults).map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  app.use(cors({ origin: origins.includes("*") ? true : origins, credentials: true }));

  // Razorpay webhook needs the exact raw bytes for signature checking, so it is registered before express.json().
  app.post("/api/payments/webhook", express.raw({ type: "*/*", limit: "1mb" }), webhook);

  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (req, res) => {
    res.json({ success: true, status: "ok", time: new Date().toISOString(), today: todayISO(), db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
  });

  // ---- User-facing API ----
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/catalog", catalogRoutes);
  app.use("/api/contact", enquiryRoutes);
  // ---- Admin API (every route requires a valid token AND role === "admin") ----
  app.use("/api/admin", adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
