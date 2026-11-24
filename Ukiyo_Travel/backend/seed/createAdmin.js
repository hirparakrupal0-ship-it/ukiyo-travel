/* =========================================================
   Create or promote an admin user.

   Usage:
     node seed/createAdmin.js <email> <password> [firstName] [lastName]
   or set ADMIN_EMAIL / ADMIN_PASSWORD in .env and run:
     npm run seed:admin

   - If the email already exists, it is promoted to admin
     (and its password is reset if one was provided).
   - Otherwise a new admin account is created.
========================================================= */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

async function run() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || "";
  const firstName = process.argv[4] || "Ukiyo";
  const lastName = process.argv[5] || "Admin";

  if (!email || !password) {
    console.error("Usage: node seed/createAdmin.js <email> <password> [firstName] [lastName]");
    console.error("   or set ADMIN_EMAIL and ADMIN_PASSWORD in .env");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("✖ Password must be at least 6 characters.");
    process.exit(1);
  }

  await connectDB();

  let user = await User.findOne({ email }).select("+password");
  if (user) {
    user.role = "admin";
    if (password) user.password = password; // re-hashed by the pre-save hook
    await user.save();
    console.log(`✔ Promoted existing user to admin: ${email}`);
  } else {
    user = await User.create({ firstName, lastName, email, password, role: "admin" });
    console.log(`✔ Created new admin: ${email}`);
  }

  console.log("  Login with this email/password, then open the Admin Panel (default http://localhost:3001)");
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("✖ Failed:", err.message);
  process.exit(1);
});
