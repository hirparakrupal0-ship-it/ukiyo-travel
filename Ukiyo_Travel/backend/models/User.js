const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    // "select: false" keeps the hash out of query results by default.
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },

    // ----- Optional profile fields -----
    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: [20, "Phone number cannot exceed 20 characters"],
    },
    country: {
      type: String,
      trim: true,
      default: "",
      maxlength: [60, "Country cannot exceed 60 characters"],
    },
    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: [60, "City cannot exceed 60 characters"],
    },
    bio: {
      type: String,
      trim: true,
      default: "",
      maxlength: [300, "Bio cannot exceed 300 characters"],
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },

    // Saved destination slugs (e.g. "goa", "kerala").
    wishlist: {
      type: [String],
      default: [],
    },

    // Access role. Admins can reach the admin panel and its API.
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // Admin can deactivate an account. Missing (legacy users) is treated as active.
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash the password before saving, but only when it has changed.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance helper to compare a plaintext password against the stored hash.
userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
