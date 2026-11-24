/* =========================================================
   Brings data written by EITHER original project in line with the merged schema.
   Idempotent and non-destructive: it never deletes records or changes booking status.

     1. Smart bookings:  bookingRef -> reference
     2. Smart bookings paid via the old flow (paymentStatus "paid", no Payment record):
        create the matching PAID Payment so the admin dashboard revenue includes them
     3. Bookings missing amount / destination: backfill from the catalog
     4. Command Center reviews with status "hidden" -> "rejected"
========================================================= */
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const { loadMaps, destinationOf } = require("./catalog");
const { priceToNumber } = require("./money");
const { paymentId } = require("./reference");

async function syncLegacyData({ apply = true, log = () => {} } = {}) {
  const counts = { references: 0, paidPayments: 0, backfilled: 0, reviews: 0 };
  const maps = await loadMaps();
  const bookings = await Booking.find();

  for (const b of bookings) {
    let dirty = false;
    if (!b.reference && b.bookingRef) { b.reference = b.bookingRef; counts.references++; dirty = true; log(`reference ${b._id} <- ${b.bookingRef}`); }
    if (!b.amount) { b.unitPrice = priceToNumber(b.price); b.amount = b.unitPrice * (b.travellers || 1); counts.backfilled++; dirty = true; }
    if (!b.destinationName) {
      const d = destinationOf(maps, b.itemType, b.itemId, b.title);
      if (d.name) { b.destinationSlug = d.slug; b.destinationName = d.name; dirty = true; }
    }
    if (b.paymentStatus === "paid" && !b.paidAt) { b.paidAt = b.updatedAt || b.createdAt; dirty = true; }

    const needsPaid = b.paymentStatus === "paid" && b.amount > 0 && !(await Payment.exists({ booking: b._id, status: { $in: ["paid", "refunded"] } }));
    if (apply && dirty) await b.save();
    if (needsPaid) {
      counts.paidPayments++;
      log(`paid payment for ${b._id} (${b.amount})`);
      if (apply) {
        const gatewayPaymentId = b.razorpayPaymentId || undefined;
        const taken = gatewayPaymentId ? await Payment.exists({ gatewayPaymentId }) : false;
        await Payment.create({
          paymentId: paymentId(), booking: b._id, user: b.user, amount: b.amount, status: "paid",
          method: ["card", "upi", "netbanking"].includes(b.paymentMethod) ? b.paymentMethod : null,
          gateway: gatewayPaymentId ? "razorpay" : "sandbox",
          transactionId: b.transactionId || gatewayPaymentId || "",
          gatewayOrderId: b.razorpayOrderId || undefined,
          gatewayPaymentId: taken ? undefined : gatewayPaymentId,
          details: b.paymentNote ? { note: b.paymentNote } : {},
          paidFor: b._id, attemptedAt: b.paidAt, paidAt: b.paidAt || b.updatedAt,
        });
      }
    }
  }
  const hidden = await Review.countDocuments({ status: "hidden" });
  if (hidden) { counts.reviews = hidden; if (apply) await Review.updateMany({ status: "hidden" }, { $set: { status: "rejected" } }); }

  const changed = Object.values(counts).some(Boolean);
  return { changed, counts };
}

module.exports = { syncLegacyData };
