const mongoose = require("mongoose");

/**
 * Review — written by the owner of a CONFIRMED booking, one per booking.
 * Moderation: new reviews are "pending". An admin approves or rejects them;
 * only "approved" reviews are shown on the user website or counted in ratings.
 * ("hidden" is a legacy value from the Command Center; it is treated as rejected.)
 */
const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true }, // one review per booking
    itemType: { type: String, enum: ["package", "destination", "hotel"], required: true },
    itemId: { type: String, required: true },
    itemTitle: { type: String, default: "" },
    destinationSlug: { type: String, default: "", index: true },
    destinationName: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 1000 },
    status: { type: String, enum: ["pending", "approved", "rejected", "hidden"], default: "pending", index: true },
    moderatedAt: { type: Date, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);
