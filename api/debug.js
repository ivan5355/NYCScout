/**
 * Debug endpoint to check database contents.
 * GET /api/debug → shows collection counts and sample documents
 */
const { connectDB } = require("../lib/db");
const Restaurant = require("../lib/models/Restaurant");
const Event = require("../lib/models/Event");

module.exports = async function handler(req, res) {
    try {
        await connectDB();

        const restaurantCount = await Restaurant.countDocuments();
        const eventCount = await Event.countDocuments();

        const sampleRestaurants = await Restaurant.find().limit(3).lean();
        const sampleEvents = await Event.find().limit(3).lean();

        res.json({
            restaurantCount,
            eventCount,
            sampleRestaurants,
            sampleEvents,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
