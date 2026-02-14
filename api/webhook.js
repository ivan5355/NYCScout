/**
 * NYC Scout — Vercel Serverless Webhook Handler
 *
 * Handles:
 *   GET  /api/webhook → Meta webhook verification
 *   POST /api/webhook → Incoming Instagram DM processing
 *
 * Flow:
 *   1. Verify signature (APP_SECRET)
 *   2. Check rate limit
 *   3. Load user context (last 3 conversations)
 *   4. Parse intent via Gemini
 *   5. If confident → query MongoDB → format → send recommendations
 *   6. If not confident → send clarifying question
 *   7. Log conversation
 *   8. Update user patterns
 */

const crypto = require("crypto");
const { connectDB } = require("../lib/db");
const { checkRateLimit } = require("../lib/rateLimiter");
const { parseIntent, formatRecommendations, generatePatternAwareGreeting } = require("../lib/gemini");
const { queryRestaurants, queryEvents } = require("../lib/recommend");
const { sendMessage, sendMessageSequence } = require("../lib/instagram");
const { updateUserPatterns, getUserProfile } = require("../lib/userPatterns");
const Conversation = require("../lib/models/Conversation");

// ─── Signature Verification ────────────────────────────────────────────────────
function verifySignature(req, rawBody) {
    const signature = req.headers["x-hub-signature-256"];
    if (!signature || !process.env.APP_SECRET) return false;

    const expectedSig =
        "sha256=" +
        crypto
            .createHmac("sha256", process.env.APP_SECRET)
            .update(rawBody)
            .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig)
    );
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
    // ── GET: Webhook Verification ──
    if (req.method === "GET") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
            console.log("[Webhook] Verified");
            return res.status(200).send(challenge);
        }
        return res.status(403).send("Forbidden");
    }

    // ── POST: Incoming Messages ──
    if (req.method === "POST") {
        // Collect raw body for signature verification
        let rawBody;
        if (typeof req.body === "string") {
            rawBody = req.body;
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString("utf8");
        } else {
            rawBody = JSON.stringify(req.body);
        }

        // Verify signature
        if (process.env.APP_SECRET && !verifySignature(req, rawBody)) {
            console.error("[Webhook] Invalid signature");
            return res.status(401).send("Invalid signature");
        }

        // Respond immediately to avoid Meta timeout
        res.status(200).send("EVENT_RECEIVED");

        // Parse body
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

        if (body.object !== "instagram") return;

        try {
            await connectDB();

            for (const entry of body.entry || []) {
                for (const event of entry.messaging || []) {
                    // Skip echoed messages from the bot itself
                    if (event.message?.is_echo) continue;

                    const senderId = event.sender?.id;
                    const messageText = event.message?.text;

                    if (!senderId || !messageText) continue;

                    await processMessage(senderId, messageText);
                }
            }
        } catch (err) {
            console.error("[Webhook] Processing error:", err);
        }

        return;
    }

    return res.status(405).send("Method Not Allowed");
};

// ─── Core Message Processor ────────────────────────────────────────────────────
async function processMessage(senderId, messageText) {
    try {
        // 1. Rate limit check
        const { allowed } = await checkRateLimit(senderId);
        if (!allowed) {
            // Calm throttling message (implementation.md Section 4)
            await sendMessage(
                senderId,
                "Give me a moment before we look again — try again shortly."
            );
            return;
        }

        // 2. Load prior context (last 3 conversations)
        const priorContext = await Conversation.find({ instagram_id: senderId })
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();

        // 3. Check for pattern-aware greeting opportunity
        const userProfile = await getUserProfile(senderId);
        const patternGreeting = await generatePatternAwareGreeting(userProfile);

        // 4. Parse intent via Gemini
        const intent = await parseIntent(messageText, priorContext);
        console.log("[Intent]", JSON.stringify(intent));

        // 5. Handle based on confidence / action
        let botResponse = "";
        let recommendationsReturned = [];

        if (intent.action === "recommend" && intent.type !== "unclear") {
            // ── Query database ──
            let results = [];

            if (intent.type === "restaurant") {
                results = await queryRestaurants(intent);
            } else if (intent.type === "event") {
                results = await queryEvents(intent);
            }

            if (results.length === 0) {
                // Calm no-results message (design.md)
                const noResults =
                    "I couldn't find something that fits that perfectly yet. Want to try a nearby neighborhood or shift the vibe a little?";
                await sendMessage(senderId, noResults);
                botResponse = noResults;
            } else {
                // Format and send recommendations
                const messages = await formatRecommendations(results, intent);

                // Optionally prepend pattern-aware greeting
                const allMessages = patternGreeting
                    ? [patternGreeting, ...messages]
                    : messages;

                await sendMessageSequence(senderId, allMessages);
                botResponse = allMessages.join(" | ");
                recommendationsReturned = results.map((r) => ({
                    name: r.name,
                    type: intent.type,
                }));

                // Update user patterns
                await updateUserPatterns(senderId, intent);
            }
        } else if (
            intent.action === "clarify" ||
            intent.action === "direct"
        ) {
            // ── Send clarifying question ──
            const question =
                intent.clarifyingQuestion ||
                "Hey — tell me what you're in the mood for.";
            await sendMessage(senderId, question);
            botResponse = question;
        } else {
            // Fallback welcome
            const welcome =
                "Hey — tell me what you're in the mood for. Food, something happening tonight, or just an idea?";
            await sendMessage(senderId, welcome);
            botResponse = welcome;
        }

        // 6. Log conversation
        await Conversation.create({
            instagram_id: senderId,
            raw_message: messageText,
            parsed_intent: intent,
            confidence_score: intent.confidenceScore,
            clarifying_question_sent:
                intent.action === "clarify" || intent.action === "direct",
            recommendations_returned: recommendationsReturned,
            bot_response: botResponse,
        });
    } catch (err) {
        console.error("[ProcessMessage] Error:", err);

        // Calm failure message (implementation.md Section 8)
        try {
            await sendMessage(
                senderId,
                "Something's shifting on my end. Give me one second."
            );
        } catch (sendErr) {
            console.error("[ProcessMessage] Failed to send error message:", sendErr);
        }
    }
}
