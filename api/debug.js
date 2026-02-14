const { connectDB } = require("../lib/db");
const mongoose = require("mongoose");

module.exports = async function handler(req, res) {
    try {
        const dbs = await connectDB();

        // List collections in both databases
        const goodrecCollections = await dbs.goodrec.db.listCollections().toArray();
        const nycEventsCollections = await dbs.nycEvents.db.listCollections().toArray();

        // Also check nyc_events (underscore)
        const nycEventsUnderscore = mongoose.connection.useDb("nyc_events", { useCache: true });
        const nycUnderscoreCollections = await nycEventsUnderscore.db.listCollections().toArray();

        // Count documents in each collection
        const results = {};

        for (const col of goodrecCollections) {
            const count = await dbs.goodrec.db.collection(col.name).countDocuments();
            results[`goodrec.${col.name}`] = count;
        }

        for (const col of nycEventsCollections) {
            const count = await dbs.nycEvents.db.collection(col.name).countDocuments();
            results[`nyc-events.${col.name}`] = count;
        }

        for (const col of nycUnderscoreCollections) {
            const count = await nycEventsUnderscore.db.collection(col.name).countDocuments();
            results[`nyc_events.${col.name}`] = count;
        }

        res.json({
            goodrecCollections: goodrecCollections.map(c => c.name),
            nycEventsCollections: nycEventsCollections.map(c => c.name),
            nycUnderscoreCollections: nycUnderscoreCollections.map(c => c.name),
            documentCounts: results,
        });
    } catch (err) {
        console.error("[Debug] Error:", err);
        res.status(500).json({ error: err.message });
    }
};
