/* =========================================================
   Bring EXISTING data in line with the merged schema (also runs automatically at server start
   unless AUTO_MIGRATE=false). Safe by default: prints what it WOULD do. Add --apply to write.

     node seed/migrateBookings.js            # dry run
     node seed/migrateBookings.js --apply    # perform changes
     node seed/migrateBookings.js --apply --reset-unpaid-confirmed
         also moves bookings that are "confirmed" but were never paid back to "Pending Payment"
         (only needed for data from before the payment rules existed)
========================================================= */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Booking = require("../models/Booking");
const { ensureSeeded } = require("../utils/catalog");
const { syncLegacyData } = require("../utils/legacySync");

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectDB();
  await ensureSeeded();
  const r = await syncLegacyData({ apply: APPLY, log: (m) => console.log((APPLY ? "UPDATE " : "would update ") + m) });
  console.log(`\n${APPLY ? "Done" : "Dry run"}:`, r.counts);
  if (process.argv.includes("--reset-unpaid-confirmed")) {
    const q = { status: "confirmed", paymentStatus: { $ne: "paid" } };
    const n = await Booking.countDocuments(q);
    if (APPLY) await Booking.updateMany(q, { $set: { status: "pending" } });
    console.log(`${APPLY ? "Reset" : "Would reset"} ${n} confirmed-but-unpaid booking(s) to Pending Payment.`);
  }
  if (!APPLY) console.log("Nothing written (use --apply).");
  await mongoose.connection.close();
  process.exit(0);
})().catch((e) => { console.error("✖", e.message); process.exit(1); });
