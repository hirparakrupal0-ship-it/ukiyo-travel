/**
 * 404 handler for unknown routes.
 */
function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
}

/**
 * Central error handler. Converts common Mongoose errors into clean messages.
 */
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || "Server error";

  // Duplicate key (e.g. email already registered)
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || { field: "" })[0];
    message = field === "email" ? "An account with that email already exists" : `A record with that ${field} already exists`;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(", ");
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
