const { connectDB } = require("./db");
const { getModels } = require("./models/index");

/**
 * Query restaurants using parsed intent from Gemini.
 * Actual schema in NYC_SCOUT.restaurants:
 *   Name (string), fullAddress (string), cuisineDescription (string),
 *   priceLevel (string), rating (number)
 */
async function queryRestaurants(intent) {
    const dbs = await connectDB();
    const { Restaurant } = getModels(dbs);

    const filter = {};

    const isBroad = !intent.borough || ["citywide", "anywhere", "all", "nyc", "new york city", "new york"].includes(intent.borough.toLowerCase());

    if (intent.borough && !isBroad) {
        // borough is usually the last word in fullAddress
        filter.fullAddress = new RegExp(intent.borough, "i");
    }

    if (intent.cuisine) {
        filter.cuisineDescription = new RegExp(intent.cuisine, "i");
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
        filter.priceLevel = tier;
    }

    // Fetch up to 10 matches, sorted by rating if available
    let results = await Restaurant.find(filter)
        .lean()
        .limit(10)
        .sort({ rating: -1 });

    // Return top 4
    return results.slice(0, 4);
}

/**
 * Query events using parsed intent from Gemini.
 * Actual schema in NYC_SCOUT.events:
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

    const isBroad = !intent.borough || ["citywide", "anywhere", "all", "nyc", "new york city", "new york"].includes(intent.borough.toLowerCase());

    if (intent.borough && !isBroad) {
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

    return results.slice(0, 4);
}

module.exports = { queryRestaurants, queryEvents };
