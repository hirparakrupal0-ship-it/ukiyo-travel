const Payment = require("../models/Payment");
const { refundAtGateway } = require("../services/refundService");

/**
 * Cancel a booking. A paid booking is refunded first (at the gateway if it was a Razorpay payment);
 * if the gateway refuses, nothing is changed. Unpaid attempts are closed as "cancelled".
 */
async function cancelAndRefund(booking) {
  const now = new Date();
  if (booking.paymentStatus === "paid") {
    const paid = await Payment.find({ booking: booking._id, status: "paid" });
    for (const p of paid) {
      const { refundId } = await refundAtGateway(p);
      p.status = "refunded"; p.refundedAt = now; if (refundId) p.refundId = refundId;
      await p.save();
    }
    booking.paymentStatus = "refunded";
  }
  // Placeholders nobody ever tried to pay are removed; attempted-but-unpaid ones are kept as "cancelled".
  await Payment.deleteMany({ booking: booking._id, status: "pending", method: null, attemptedAt: null });
  await Payment.updateMany({ booking: booking._id, status: "pending" }, { $set: { status: "cancelled", cancelledAt: now } });
  booking.status = "cancelled";
  booking.cancelledAt = now;
  await booking.save();
  return booking;
}

module.exports = { cancelAndRefund };
