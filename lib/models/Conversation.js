const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
    {
        instagram_id: { type: String, required: true },
        raw_message: String,
        parsed_intent: mongoose.Schema.Types.Mixed,
        confidence_score: Number,
        clarifying_question_sent: { type: Boolean, default: false },
        recommendations_returned: [mongoose.Schema.Types.Mixed],
        bot_response: String,
    },
    { collection: "conversations", timestamps: true }
);

conversationSchema.index({ instagram_id: 1, createdAt: -1 });

module.exports = conversationSchema;
