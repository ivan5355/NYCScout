const User = require("./models/User");

/**
 * Update user preference signals after a successful recommendation.
 * This is "soft memory" — gentle pattern tracking per masterplan.md.
 * Never over-personalize. Kindness > cleverness.
 */
async function updateUserPatterns(instagramId, intent) {
    let user = await User.findOne({ instagram_id: instagramId });

    if (!user) {
        user = new User({ instagram_id: instagramId });
    }

    user.interaction_count += 1;
    user.last_interaction = new Date();

    // Track borough tendency
    if (intent.borough) {
        const current = user.borough_tendency.get(intent.borough) || 0;
        user.borough_tendency.set(intent.borough, current + 1);
    }

    // Track cuisine preference
    if (intent.cuisine) {
        const current = user.cuisine_preferences.get(intent.cuisine) || 0;
        user.cuisine_preferences.set(intent.cuisine, current + 1);
    }

    // Track event categories
    if (intent.category) {
        const current = user.event_category_scores.get(intent.category) || 0;
        user.event_category_scores.set(intent.category, current + 1);
    }

    // Update budget bias
    if (intent.priceIntent) {
        const priceScore = { $: 1, $$: 2, $$$: 3, $$$$: 4 };
        const score = priceScore[intent.priceIntent] || 2;
        user.budget_bias_score =
            user.budget_bias_score === 0
                ? score
                : (user.budget_bias_score + score) / 2;
    }

    await user.save();
    return user;
}

/**
 * Get a user's profile for pattern-aware greetings.
 */
async function getUserProfile(instagramId) {
    return User.findOne({ instagram_id: instagramId }).lean();
}

module.exports = { updateUserPatterns, getUserProfile };
