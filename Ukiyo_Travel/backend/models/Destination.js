const mongoose = require("mongoose");

const destinationSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    image: { type: String, default: "" },
    short: { type: String, default: "", maxlength: 200 },
    description: { type: String, default: "", maxlength: 1500 },
    highlights: { type: [String], default: [] },
    bestTime: { type: String, default: "" },
    priceFrom: { type: String, default: "" },        // display string, e.g. "₹9,999"
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    priority: { type: Number, default: 100 },        // lower = shown first
  },
  { timestamps: true }
);

module.exports = mongoose.model("Destination", destinationSchema);
