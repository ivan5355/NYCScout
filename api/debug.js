/**
 * Debug endpoint to check database contents across multiple databases.
 * GET /api/debug → shows collection counts and sample documents
 */
const { connectDB } = require("../lib/db");
const eventSchema = require("../lib/models/Event");
const restaurantSchema = require("../lib/models/Restaurant");

module.exports = async function handler(req, res) {
    try {
        const dbs = await connectDB();

        // Bind models to correct DBs
        // Event is in goodrec
        const Event = dbs.goodrec.models.Event || dbs.goodrec.model("Event", eventSchema);

        // Restaurant is in nyc-events
        const Restaurant = dbs.nycEvents.models.Restaurant || dbs.nycEvents.model("Restaurant", restaurantSchema);

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
