const express = require("express");
const admin = require("../controllers/adminController");
const analytics = require("../controllers/analyticsController");
const payments = require("../controllers/paymentController");
const reviews = require("../controllers/reviewController");
const catalog = require("../controllers/catalogController");
const { protect, admin: adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// Every admin route requires a logged-in admin (401 if not logged in, 403 if not admin).
router.use(protect, adminOnly);

// Legacy summary (kept for backward compatibility)
router.get("/stats", admin.getStats);

// Intelligence
router.get("/dashboard", analytics.dashboard);
router.get("/trending", analytics.trending);
router.get("/insights", analytics.insights);
router.get("/calendar", analytics.calendar);
router.get("/calendar/day", analytics.calendarDay);

// Alerts
router.get("/alerts", analytics.alerts);
router.post("/alerts/state", analytics.setAlertState);
router.post("/alerts/state-all", analytics.setAllAlertStates);

// Users
router.get("/users", admin.getUsers);
router.get("/users/:id", admin.getUserDetail);
router.patch("/users/:id/role", admin.setUserRole);
router.patch("/users/:id/active", admin.setUserActive);
router.delete("/users/:id", admin.deleteUser);

// Bookings
router.get("/bookings", admin.getBookings);
router.patch("/bookings/:id", admin.setBookingStatus);
router.delete("/bookings/:id", admin.deleteBooking);

// Payments
router.get("/payments", payments.adminGetPayments);
router.get("/payments/:id", payments.adminGetPayment);
router.post("/payments/:id/refund", payments.adminRefund);

// Reviews
router.get("/reviews", reviews.adminReviews);
router.patch("/reviews/:id", reviews.adminSetReviewStatus);
router.delete("/reviews/:id", reviews.adminDeleteReview);

// Enquiries
router.get("/enquiries", admin.getEnquiries);
router.patch("/enquiries/:id", admin.setEnquiryStatus);
router.delete("/enquiries/:id", admin.deleteEnquiry);

// Destinations / packages / hotels / banners (+ featured, active, priority)
router.get("/catalog/:type", catalog.adminList);
router.post("/catalog/:type", catalog.adminCreate);
router.post("/catalog/:type/reorder", catalog.adminReorder);
router.put("/catalog/:type/:id", catalog.adminUpdate);
router.patch("/catalog/:type/:id/flags", catalog.adminFlags);
router.delete("/catalog/:type/:id", catalog.adminDelete);

module.exports = router;
