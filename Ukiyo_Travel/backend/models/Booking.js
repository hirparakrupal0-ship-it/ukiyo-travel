const mongoose = require("mongoose");

/**
 * Booking — one document per trip/hotel booking.
 *
 * Merged from the two original projects:
 *   - Command Center fields (reference, unitPrice, destination*, refunded, cancelledAt)
 *   - Smart user-site fields (bookingRef, paymentMethod, razorpay*) are kept as
 *     LEGACY read-only fields so existing documents keep loading. New code never
 *     writes them; the Payment collection is the source of truth for payments.
 */
const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // What is being booked: a package, a destination or a hotel.
    itemType: { type: String, enum: ["package", "destination", "hotel"], required: true },
    itemId: { type: String, required: true },   // slug/id from the catalog
    title: { type: String, required: true },     // human-readable name at booking time
    price: { type: String, default: "" },        // display price snapshot, e.g. "₹9,999"
    travelDate: { type: String, default: "" },   // YYYY-MM-DD
    travellers: { type: Number, default: 1, min: 1, max: 30 },
    notes: { type: String, default: "", maxlength: 500 },
    // "pending" == Pending Payment. Only a verified successful payment moves it to "confirmed".
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },

    reference: { type: String, unique: true, sparse: true }, // UKY-2026-XXXXX, issued on payment success
    amount: { type: Number, default: 0, min: 0 },            // total in INR, computed server-side
    unitPrice: { type: Number, default: 0, min: 0 },
    destinationSlug: { type: String, default: "", index: true },
    destinationName: { type: String, default: "" },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "failed", "refunded"], default: "unpaid" },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // ----- LEGACY (Smart user site) — read-only, kept so old data stays readable -----
    bookingRef: { type: String },
    paymentMethod: { type: String },
    paymentNote: { type: String },
    transactionId: { type: String },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
