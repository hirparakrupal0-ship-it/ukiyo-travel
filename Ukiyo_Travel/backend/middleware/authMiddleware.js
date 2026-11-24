const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect routes: require a valid "Authorization: Bearer <token>" header.
 * On success attaches the authenticated user to req.user.
 */
async function protect(req, res, next) {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }
    if (user.isActive === false) {
      return res.status(403).json({ success: false, code: "ACCOUNT_DEACTIVATED", message: "Your account has been deactivated. Please contact Ukiyo Travel support." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authorized, token invalid or expired" });
  }
}

/**
 * Require the authenticated user to be an admin. Use after `protect`.
 */
function admin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ success: false, message: "Admin access required" });
}

module.exports = { protect, admin };
