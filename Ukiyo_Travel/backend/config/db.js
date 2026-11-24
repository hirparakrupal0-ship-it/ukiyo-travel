const mongoose = require("mongoose");

/**
 * Connect to MongoDB using MONGO_URI. Throws on failure; the caller decides what to do
 * (server.js and the CLI scripts exit with a clear message, tests can handle it).
 */
async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error("MONGO_URI is not set. Copy .env.example to .env and set it.");
  mongoose.set("strictQuery", true);
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  return conn;
}

module.exports = connectDB;
