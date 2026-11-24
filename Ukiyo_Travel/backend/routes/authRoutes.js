const express = require("express");
const { body } = require("express-validator");
const { register, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Validation rules mirror the frontend form requirements.
const registerRules = [
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("email").trim().isEmail().withMessage("Please provide a valid email address"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

const loginRules = [
  body("email").trim().isEmail().withMessage("Please provide a valid email address"),
  body("password").notEmpty().withMessage("Password is required"),
];

router.post("/register", registerRules, register);
router.post("/login", loginRules, login);
router.get("/me", protect, getMe);

module.exports = router;
