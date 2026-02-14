const UserLimit = require("./models/UserLimit");

const MAX_REQUESTS = 30;          // per window
const WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check whether a user is within rate limits.
 * Returns { allowed: boolean, remaining: number }
 */
async function checkRateLimit(instagramId) {
    const now = new Date();

    let record = await UserLimit.findOne({ instagram_id: instagramId });

    if (!record) {
        record = await UserLimit.create({
            instagram_id: instagramId,
            request_count: 1,
            window_start: now,
            last_request_timestamp: now,
        });
        return { allowed: true, remaining: MAX_REQUESTS - 1 };
    }

    // Reset window if expired
    const elapsed = now.getTime() - record.window_start.getTime();
    if (elapsed > WINDOW_DURATION_MS) {
        record.request_count = 1;
        record.window_start = now;
        record.last_request_timestamp = now;
        await record.save();
        return { allowed: true, remaining: MAX_REQUESTS - 1 };
    }

    // Check limit
    if (record.request_count >= MAX_REQUESTS) {
        return { allowed: false, remaining: 0 };
    }

    // Increment
    record.request_count += 1;
    record.last_request_timestamp = now;
    await record.save();

    return { allowed: true, remaining: MAX_REQUESTS - record.request_count };
}

module.exports = { checkRateLimit };
