const { connectDB } = require("./db");
const { getModels } = require("./models/index");

/**
 * Query restaurants using parsed intent from Gemini.
 * Actual schema in nyc.restaurants:
 *   cuisine (string), location.borough (nested), metrics.price_range (nested),
 *   metrics.popularity_score (number), location.neighborhood, location.address
 */
async function queryRestaurants(intent) {
    const dbs = await connectDB();
    const { Restaurant } = getModels(dbs);

    const filter = {};

    if (intent.borough) {
        filter["location.borough"] = new RegExp(intent.borough, "i");
    }

    if (intent.cuisine) {
        filter.cuisine = new RegExp(intent.cuisine, "i");
    }

    if (intent.priceIntent) {
        const priceMap = {
            cheap: "$",
            affordable: "$",
            moderate: "$$",
            "mid-range": "$$",
            upscale: "$$$",
            expensive: "$$$",
            fancy: "$$$$",
            splurge: "$$$$",
        };
        const tier =
            priceMap[intent.priceIntent.toLowerCase()] || intent.priceIntent;
        filter["metrics.price_range"] = tier;
    }

    // Fetch up to 10 matches, sorted by popularity
    let results = await Restaurant.find(filter)
        .lean()
        .limit(10)
        .sort({ "metrics.popularity_score": -1 });

    // Return top 2-3
    return results.slice(0, 3);
}

/**
 * Query events using parsed intent from Gemini.
 * Actual schema in goodrec.events:
 *   name, date (string "YYYY-MM-DD"), time (string), location (string with borough),
 *   category, price, link, isActive, source, platform
 */
async function queryEvents(intent) {
    const dbs = await connectDB();
    const { Event } = getModels(dbs);

    const filter = {
        isActive: true,
        // Filter for future events (date is stored as string "YYYY-MM-DD")
        date: { $gte: new Date().toISOString().split("T")[0] },
    };

    if (intent.borough) {
        // borough is embedded in the 'location' string (e.g. "Ace Hotel Brooklyn — Brooklyn")
        filter.location = new RegExp(intent.borough, "i");
    }

    if (intent.category) {
        filter.category = new RegExp(intent.category, "i");
    }

    // Fetch up to 10, sorted by date
    let results = await Event.find(filter)
        .lean()
        .limit(10)
        .sort({ date: 1 });

    return results.slice(0, 3);
}

module.exports = { queryRestaurants, queryEvents };
