const { connectDB } = require("./db");
const { getModels } = require("./models/index");

/**
 * Query restaurants using parsed intent from Gemini.
 * Follows the Restaurant Query Flow from implementation.md:
 *   Filter borough → cuisine_tags → price_tier → limit 10 → return top 2-3
 */
async function queryRestaurants(intent) {
    const dbs = await connectDB();
    const { Restaurant } = getModels(dbs);

    const filter = {};

    if (intent.borough) {
        filter.borough = new RegExp(intent.borough, "i");
    }

    if (intent.cuisine) {
        filter.cuisine_tags = { $regex: new RegExp(intent.cuisine, "i") };
    }

    if (intent.priceIntent) {
        // Normalize price signals: "$", "$$", "$$$", "$$$$", or descriptive
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
        filter.price_tier = tier;
    }

    // Fetch up to 10 matches
    let results = await Restaurant.find(filter)
        .lean()
        .limit(10)
        .sort({ rating_bias_score: -1 });


    // Return top 2-3 (prefer 2 when uncertain, per design.md)
    return results.slice(0, 3);
}

/**
 * Query events using parsed intent from Gemini.
 * Follows the Event Query Flow from implementation.md:
 *   isActive=true → date_time>=now → borough → category → price → limit 10 → return 2-3
 */
async function queryEvents(intent) {
    const dbs = await connectDB();
    const { Event } = getModels(dbs);

    const filter = {
        isActive: true,
        date_time: { $gte: new Date() },
    };

    if (intent.borough) {
        filter.borough = new RegExp(intent.borough, "i");
    }

    if (intent.category) {
        filter.category = new RegExp(intent.category, "i");
    }

    // Fetch up to 10
    let results = await Event.find(filter)
        .lean()
        .limit(10)
        .sort({ date_time: 1 });


    return results.slice(0, 3);
}

module.exports = { queryRestaurants, queryEvents };
