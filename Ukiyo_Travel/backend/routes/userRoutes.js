const express = require("express");
const { body } = require("express-validator");
const {
  getProfile,
  updateProfile,
  changePassword,
  getWishlist,
  addWishlist,
  removeWishlist,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// All routes here require a valid token.
router.use(protect);

const profileRules = [
  body("firstName").optional().trim().notEmpty().withMessage("First name cannot be empty"),
  body("lastName").optional().trim().notEmpty().withMessage("Last name cannot be empty"),
  body("email").optional().trim().isEmail().withMessage("Please provide a valid email address"),
  body("phone").optional().trim().isLength({ max: 20 }).withMessage("Phone number is too long"),
  body("country").optional().trim().isLength({ max: 60 }).withMessage("Country is too long"),
  body("city").optional().trim().isLength({ max: 60 }).withMessage("City is too long"),
  body("bio").optional().trim().isLength({ max: 300 }).withMessage("Bio cannot exceed 300 characters"),
  body("avatarUrl").optional({ checkFalsy: true }).trim().isURL().withMessage("Avatar must be a valid URL"),
];

const passwordRules = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
];

router.get("/profile", getProfile);
router.put("/profile", profileRules, updateProfile);
router.put("/password", passwordRules, changePassword);

// Wishlist
router.get("/wishlist", getWishlist);
router.post("/wishlist", body("slug").trim().notEmpty().withMessage("A destination is required"), addWishlist);
router.delete("/wishlist/:slug", removeWishlist);

module.exports = router;
