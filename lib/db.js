const mongoose = require("mongoose");

let cachedConnection = null;

/**
 * Connect to MongoDB with connection caching for serverless environments.
 * Re-uses existing connection across warm invocations on Vercel.
 */
async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  cachedConnection = await mongoose.connect(uri, {
    retryWrites: true,
    w: "majority",
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  console.log("[NYC Scout] MongoDB connected");
  return cachedConnection;
}

module.exports = { connectDB };
