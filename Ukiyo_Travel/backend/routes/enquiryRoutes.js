const express = require("express");
const { body } = require("express-validator");
const { createEnquiry } = require("../controllers/enquiryController");

const router = express.Router();

const enquiryRules = [
  body("name").trim().notEmpty().withMessage("Your name is required"),
  body("email").trim().isEmail().withMessage("A valid email is required"),
  body("message").optional().trim().isLength({ max: 1000 }).withMessage("Message is too long"),
];

// Public — no auth required.
router.post("/", enquiryRules, createEnquiry);

module.exports = router;
