/**
 * Debug endpoint to check database contents across multiple databases.
 * GET /api/debug → shows collection counts and sample documents
 */
const { connectDB } = require("../lib/db");
const { getModels } = require("../lib/models/index");

module.exports = async function handler(req, res) {
    try {
        const dbs = await connectDB();
        const { Restaurant, Event } = getModels(dbs);

        const restaurantCount = await Restaurant.countDocuments();
        const eventCount = await Event.countDocuments();

        const sampleRestaurants = await Restaurant.find().limit(3).lean();
        const sampleEvents = await Event.find().limit(3).lean();

        res.json({
            databases: {
                goodrec: {
                    eventCount
                },
                nycEvents: {
                    restaurantCount
                }
            },
            sampleRestaurants,
            sampleEvents,
        });
    } catch (err) {
        console.error("[Debug] Error:", err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
};
