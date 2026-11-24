const express = require("express");
const { getConfig, payDemo, createOrder, verifyPayment, markFailed } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");
const { payLimiter } = require("../middleware/rateLimiters");

// NOTE: POST /api/payments/webhook is mounted in app.js (it needs the raw request body).
const router = express.Router();
router.use(protect, payLimiter);

router.get("/config", getConfig);
router.post("/demo", payDemo);       // sandbox gateway (only when Razorpay is not configured)
router.post("/order", createOrder);  // Razorpay
router.post("/verify", verifyPayment);
router.post("/failed", markFailed);

module.exports = router;
