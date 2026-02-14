const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        category: String,
        borough: String,
        date_time: Date,
        price: String,
        isActive: { type: Boolean, default: true },
        link: String,
        vibe_tags: [String],
        last_synced: { type: Date, default: Date.now },
    },
    { collection: "events" }
);

// Indexes matching implementation.md spec
eventSchema.index({ borough: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ date_time: 1 });
eventSchema.index({ isActive: 1 });
eventSchema.index({ price: 1 });

module.exports = eventSchema;
