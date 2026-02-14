const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        instagram_id: { type: String, required: true, unique: true },
        borough_tendency: { type: Map, of: Number, default: {} },
        cuisine_preferences: { type: Map, of: Number, default: {} },
        budget_bias_score: { type: Number, default: 0 },
        event_category_scores: { type: Map, of: Number, default: {} },
        interaction_count: { type: Number, default: 0 },
        last_interaction: { type: Date, default: Date.now },
    },
    { collection: "users", timestamps: true }
);

userSchema.index({ instagram_id: 1 }, { unique: true });

module.exports =
    mongoose.models.User || mongoose.model("User", userSchema);
