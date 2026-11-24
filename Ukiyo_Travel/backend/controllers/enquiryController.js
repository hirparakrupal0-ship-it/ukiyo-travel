const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const Enquiry = require("../models/Enquiry");

function collectValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    return true;
  }
  return false;
}

/**
 * @route   POST /api/contact
 * @desc    Submit a contact / trip-planning enquiry (public)
 * @access  Public — links the user if a valid token happens to be present
 */
async function createEnquiry(req, res, next) {
  try {
    if (collectValidation(req, res)) return;

    // Optionally associate with a logged-in user if a token was sent.
    let userId = null;
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (_) {
        /* ignore invalid token — enquiry is still public */
      }
    }

    const { name, email, destination, phone, message } = req.body;
    const enquiry = await Enquiry.create({ name, email, destination, phone, message, user: userId });

    res.status(201).json({
      success: true,
      message: "Thanks! Your enquiry has been received. Our team will contact you soon.",
      enquiryId: enquiry._id,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createEnquiry };
