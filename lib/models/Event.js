const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        date: String, // stored as "YYYY-MM-DD"
        time: String,
        location: String,
        description: String,
        link: String,
        price: String,
        category: String,
        source: String,
        platform: String,
        isActive: { type: Boolean, default: true },
        last_synced: { type: Date, default: Date.now },
    },
    { collection: "events" }
);

// Indexes matching NYC_SCOUT fields
eventSchema.index({ location: "text" });
eventSchema.index({ category: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ isActive: 1 });
eventSchema.index({ price: 1 });

module.exports = eventSchema;
