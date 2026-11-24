const mongoose = require("mongoose");

const alertStateSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // key = alert type + a signature of the data behind it (e.g. "pending-payments:5").
    // When the underlying data changes the key changes, so the alert returns as new.
    key: { type: String, required: true },
    state: { type: String, enum: ["read", "cleared"], required: true },
  },
  { timestamps: true }
);
alertStateSchema.index({ admin: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("AlertState", alertStateSchema);
