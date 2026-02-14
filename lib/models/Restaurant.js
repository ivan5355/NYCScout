const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        cuisine_tags: [String],
        borough: String,
        neighborhood: String,
        price_tier: String,          // "$", "$$", "$$$", "$$$$"
        vibe_tags: [String],
        rating_bias_score: Number,
        address: String,
        last_updated: { type: Date, default: Date.now },
    },
    { collection: "restaurants" }
);

// Indexes matching implementation.md spec
restaurantSchema.index({ borough: 1 });
restaurantSchema.index({ cuisine_tags: 1 });
restaurantSchema.index({ price_tier: 1 });
restaurantSchema.index({ vibe_tags: 1 });

module.exports =
    mongoose.models.Restaurant ||
    mongoose.model("Restaurant", restaurantSchema);
