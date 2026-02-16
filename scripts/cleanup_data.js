/**
 * Data Cleanup Script - Meta Platform Compliance
 * Automatically deletes conversation logs older than 30 days.
 * This ensures we don't hoard user PII (Message Content) indefinitely.
 */
require("dotenv").config({ path: ".env.local" });
const { connectDB } = require("../lib/db");
const { getModels } = require("../lib/models/index");

async function cleanupOldData() {
    try {
        console.log("🚀 Starting 30-day data cleanup...");
        const dbs = await connectDB();
        const { Conversation } = getModels(dbs);

        // Calculate the date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        console.log(`Checking for records older than: ${thirtyDaysAgo.toISOString()}`);

        const result = await Conversation.deleteMany({
            createdAt: { $lt: thirtyDaysAgo }
        });

        console.log(`✅ Success: Deleted ${result.deletedCount} old conversations.`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Error during cleanup:", err);
        process.exit(1);
    }
}

cleanupOldData();
