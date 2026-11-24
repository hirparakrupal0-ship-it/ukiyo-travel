const mongoose = require("mongoose");

// Homepage banners and promotional content managed from "Featured Content".
const bannerSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["banner", "promo"], default: "banner" },
    title: { type: String, required: true, trim: true, maxlength: 90 },
    subtitle: { type: String, default: "", trim: true, maxlength: 220 },
    imageUrl: { type: String, default: "" },
    ctaLabel: { type: String, default: "", maxlength: 30 },
    ctaLink: { type: String, default: "", maxlength: 300 },  // "#packages" or an https:// URL
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    priority: { type: Number, default: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
