const express = require("express");
const { body } = require("express-validator");
const { createBooking, getMyBookings, getMyBooking, cancelBooking } = require("../controllers/bookingController");
const { paymentOptions, payBooking } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");
const { payLimiter } = require("../middleware/rateLimiters");

const router = express.Router();
router.use(protect);

const bookingRules = [
  body("itemType").isIn(["package", "destination", "hotel"]).withMessage("Invalid booking type"),
  body("itemId").trim().notEmpty().withMessage("Missing item"),
  body("travellers").optional().isInt({ min: 1, max: 30 }).withMessage("Travellers must be between 1 and 30"),
];

router.post("/", bookingRules, createBooking);
router.get("/", getMyBookings);
router.get("/payment-options", paymentOptions); // must stay above "/:id"
router.get("/:id", getMyBooking);
router.post("/:id/pay", payLimiter, payBooking);
router.delete("/:id", cancelBooking);

module.exports = router;
