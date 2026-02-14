const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
    {
        Name: { type: String, required: true },
        fullAddress: String,
        cuisineDescription: String,
        priceLevel: String, // "$", "$$", etc.
        rating: Number,
        googlePlaceId: String,
    },
    { collection: "restaurants" }
);

// Indexes matching NYC_SCOUT fields
restaurantSchema.index({ fullAddress: "text" });
restaurantSchema.index({ cuisineDescription: 1 });
restaurantSchema.index({ priceLevel: 1 });
restaurantSchema.index({ rating: -1 });

module.exports = restaurantSchema;
