const mongoose = require("mongoose");

// Contact / "Plan your dream trip" form submissions. Public — no login required.
const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true },
    destination: { type: String, default: "", trim: true, maxlength: 100 },
    phone: { type: String, default: "", trim: true, maxlength: 20 },
    message: { type: String, default: "", trim: true, maxlength: 1000 },
    // Admin workflow: new enquiries are "unhandled" until marked handled.
    status: { type: String, enum: ["new", "handled"], default: "new", index: true },
    handledAt: { type: Date, default: null },
    // If a logged-in user submitted it, keep the link (optional).
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Enquiry", enquirySchema);
