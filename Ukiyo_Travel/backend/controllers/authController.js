const { validationResult } = require("express-validator");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const publicUser = require("../utils/publicUser");

// Collect express-validator errors into a single message, if any.
function collectValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
    return true;
  }
  return false;
}

/**
 * @route   POST /api/auth/register
 * @desc    Create a new account
 * @access  Public
 */
async function register(req, res, next) {
  try {
    if (collectValidation(req, res)) return;

    const { firstName, lastName, email, password } = req.body;

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ success: false, message: "An account with that email already exists" });
    }

    const user = await User.create({ firstName, lastName, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate and return a JWT
 * @access  Public
 */
async function login(req, res, next) {
  try {
    if (collectValidation(req, res)) return;

    const { email, password, portal } = req.body;

    // password has "select: false", so ask for it explicitly here.
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, code: "ACCOUNT_DEACTIVATED", message: "Your account has been deactivated. Please contact Ukiyo Travel support." });
    }

    // The admin panel signs in with portal:"admin"; accounts without the admin role are refused outright.
    if (portal === "admin" && user.role !== "admin") {
      return res.status(403).json({ success: false, message: "This account does not have admin access." });
    }

    user.lastLogin = new Date();
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: user.lastLogin } });
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @route   GET /api/auth/me
 * @desc    Return the currently authenticated user
 * @access  Private
 */
async function getMe(req, res) {
  res.json({ success: true, user: publicUser(req.user) });
}

module.exports = { register, login, getMe };
