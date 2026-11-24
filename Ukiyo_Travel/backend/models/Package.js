const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, trim: true, lowercase: true }, // e.g. "goa-escape"
    title: { type: String, required: true, trim: true, maxlength: 80 },
    destination: { type: String, required: true, trim: true, lowercase: true },       // destination slug
    price: { type: String, required: true },                                          // "₹9,999"
    duration: { type: String, default: "" },
    image: { type: String, default: "" },
    includes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },  // "Popular package"
    priority: { type: Number, default: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package", packageSchema);
