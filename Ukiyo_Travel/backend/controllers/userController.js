const { validationResult } = require("express-validator");
const User = require("../models/User");
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
 * @route   GET /api/user/profile
 * @desc    Get the authenticated user's full profile
 * @access  Private
 */
async function getProfile(req, res) {
  res.json({ success: true, user: publicUser(req.user) });
}

/**
 * @route   PUT /api/user/profile
 * @desc    Update the authenticated user's profile fields
 * @access  Private
 */
async function updateProfile(req, res, next) {
  try {
    if (collectValidation(req, res)) return;

    const user = req.user;

    // Only these fields may be updated through the profile endpoint.
    const editable = ["firstName", "lastName", "phone", "country", "city", "bio", "avatarUrl"];
    editable.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    // Allow changing email, but keep it unique.
    if (req.body.email !== undefined) {
      const newEmail = String(req.body.email).toLowerCase().trim();
      if (newEmail !== user.email) {
        const taken = await User.findOne({ email: newEmail });
        if (taken) {
          return res.status(409).json({ success: false, message: "That email is already in use" });
        }
        user.email = newEmail;
      }
    }

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @route   PUT /api/user/password
 * @desc    Change the authenticated user's password
 * @access  Private
 */
async function changePassword(req, res, next) {
  try {
    if (collectValidation(req, res)) return;

    const { currentPassword, newPassword } = req.body;

    // req.user was loaded without the password (select: false) — reload with it.
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const matches = await user.matchPassword(currentPassword);
    if (!matches) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword; // pre-save hook re-hashes it
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * @route   GET /api/user/wishlist
 * @desc    Get the authenticated user's saved destination slugs
 * @access  Private
 */
async function getWishlist(req, res) {
  res.json({ success: true, wishlist: req.user.wishlist || [] });
}

/**
 * @route   POST /api/user/wishlist
 * @desc    Add a destination slug to the wishlist (idempotent)
 * @access  Private
 * @body    { slug }
 */
async function addWishlist(req, res, next) {
  try {
    const slug = String(req.body.slug || "").trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ success: false, message: "A destination slug is required" });
    }
    const user = req.user;
    if (!user.wishlist.includes(slug)) {
      user.wishlist.push(slug);
      await user.save();
    }
    res.json({ success: true, message: "Added to wishlist", wishlist: user.wishlist });
  } catch (err) {
    next(err);
  }
}

/**
 * @route   DELETE /api/user/wishlist/:slug
 * @desc    Remove a destination slug from the wishlist
 * @access  Private
 */
async function removeWishlist(req, res, next) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const user = req.user;
    user.wishlist = user.wishlist.filter((s) => s !== slug);
    await user.save();
    res.json({ success: true, message: "Removed from wishlist", wishlist: user.wishlist });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getWishlist,
  addWishlist,
  removeWishlist,
};
