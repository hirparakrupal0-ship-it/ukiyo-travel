const mongoose = require("mongoose");

const hotelSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, trim: true, lowercase: true },  // e.g. "taj-goa"
    name: { type: String, required: true, trim: true, maxlength: 80 },
    city: { type: String, required: true, trim: true },                                // matches a destination name
    rating: { type: Number, default: 0, min: 0, max: 5 },                              // listing rating (admin-entered)
    price: { type: String, required: true },                                           // "₹6,500"
    perNight: { type: Boolean, default: true },
    image: { type: String, default: "" },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },  // "Recommended hotel"
    priority: { type: Number, default: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hotel", hotelSchema);
