/**
 * Script to reset all user rate limits by clearing the UserLimit collection.
 */
require("dotenv").config({ path: ".env.local" });
const { connectDB } = require("../lib/db");
const { getModels } = require("../lib/models/index");

async function resetRateLimits() {
    try {
        console.log("Connecting to database...");
        const dbs = await connectDB();
        const { UserLimit } = getModels(dbs);

        console.log("Clearing UserLimit collection...");
        const result = await UserLimit.deleteMany({});

        console.log(`Successfully reset rate limits for ${result.deletedCount} users.`);
        process.exit(0);
    } catch (err) {
        console.error("Error resetting rate limits:", err);
        process.exit(1);
    }
}

resetRateLimits();
