const express = require("express");
const { createReview, publicReviews } = require("../controllers/reviewController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/", publicReviews);          // public: approved reviews
router.post("/", protect, createReview); // logged-in owners of confirmed bookings
module.exports = router;
