const mongoose = require("mongoose");

let cachedConnection = null;
let dbs = {};

/**
 * Connect to MongoDB with connection caching for serverless environments.
 */
async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return dbs;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  // Connect to the cluster
  cachedConnection = await mongoose.connect(uri, {
    retryWrites: true,
    w: "majority",
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  // NYC Scout uses the NYC_SCOUT database exclusively now
  dbs.nycScout = cachedConnection.connection;

  console.log("[NYC Scout] MongoDB connected to NYC_SCOUT");
  return dbs;
}

module.exports = { connectDB };
