const Restaurant = require("./models/Restaurant");
const Event = require("./models/Event");

/**
 * Query restaurants using parsed intent from Gemini.
 * Follows the Restaurant Query Flow from implementation.md:
 *   Filter borough → cuisine_tags → price_tier → boost vibe_tags → limit 10 → return top 2-3
 */
async function queryRestaurants(intent) {
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

    // Boost by vibe_tags overlap if vibeSignal is present
    if (intent.vibeSignal && results.length > 0) {
        const vibe = intent.vibeSignal.toLowerCase();
        results = results.sort((a, b) => {
            const aMatch = (a.vibe_tags || []).some((v) =>
                v.toLowerCase().includes(vibe)
            );
            const bMatch = (b.vibe_tags || []).some((v) =>
                v.toLowerCase().includes(vibe)
            );
            return bMatch - aMatch;
        });
    }

    // Return top 2-3 (prefer 2 when uncertain, per design.md)
    return results.slice(0, 3);
}

/**
 * Query events using parsed intent from Gemini.
 * Follows the Event Query Flow from implementation.md:
 *   isActive=true → date_time>=now → borough → category → price → limit 10 → return 2-3
 */
async function queryEvents(intent) {
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

    // Boost by vibe_tags overlap
    if (intent.vibeSignal && results.length > 0) {
        const vibe = intent.vibeSignal.toLowerCase();
        results = results.sort((a, b) => {
            const aMatch = (a.vibe_tags || []).some((v) =>
                v.toLowerCase().includes(vibe)
            );
            const bMatch = (b.vibe_tags || []).some((v) =>
                v.toLowerCase().includes(vibe)
            );
            return bMatch - aMatch;
        });
    }

    return results.slice(0, 3);
}

module.exports = { queryRestaurants, queryEvents };
