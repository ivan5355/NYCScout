const mongoose = require("mongoose");

const userLimitSchema = new mongoose.Schema(
    {
        instagram_id: { type: String, required: true, unique: true },
        request_count: { type: Number, default: 0 },
        window_start: { type: Date, default: Date.now },
        last_request_timestamp: { type: Date, default: Date.now },
    },
    { collection: "user_limits" }
);

userLimitSchema.index({ instagram_id: 1 }, { unique: true });

module.exports =
    mongoose.models.UserLimit ||
    mongoose.model("UserLimit", userLimitSchema);
