/**
 * NYC Scout — Vercel Serverless Webhook Handler
 */

const crypto = require("crypto");
const { connectDB } = require("../lib/db");
const { getModels } = require("../lib/models/index");
const { checkRateLimit } = require("../lib/rateLimiter");
const { parseIntent, formatRecommendations, generatePatternAwareGreeting } = require("../lib/gemini");
const { queryRestaurants, queryEvents } = require("../lib/recommend");
const { sendMessage, sendMessageSequence } = require("../lib/instagram");
const { updateUserPatterns, getUserProfile } = require("../lib/userPatterns");

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

    if (req.method === "POST") {
        let rawBody;
        if (typeof req.body === "string") {
            rawBody = req.body;
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString("utf8");
        } else {
            rawBody = JSON.stringify(req.body);
        }

        if (process.env.APP_SECRET && !verifySignature(req, rawBody)) {
            console.error("[Webhook] Invalid signature");
            return res.status(401).send("Invalid signature");
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

        if (body.object !== "instagram") {
            return res.status(200).send("EVENT_RECEIVED");
        }

        try {
            const dbs = await connectDB();
            const models = getModels(dbs);

            for (const entry of body.entry || []) {
                for (const event of entry.messaging || []) {
                    if (event.message?.is_echo) continue;

                    const senderId = event.sender?.id;
                    const messageText = event.message?.text;

                    if (senderId && messageText) {
                        await processMessage(senderId, messageText, models);
                    }
                }
            }
        } catch (err) {
            console.error("[Webhook] Processing error:", err);
        }

        return res.status(200).send("EVENT_RECEIVED");
    }

    return res.status(405).send("Method Not Allowed");
};

// ─── Core Message Processor ────────────────────────────────────────────────────
async function processMessage(senderId, messageText, models) {
    const { Conversation } = models;
    try {
        // 1. Rate limit check
        const { allowed } = await checkRateLimit(senderId);
        if (!allowed) {
            await sendMessage(senderId, "Give me a moment before we look again — try again shortly.");
            return;
        }

        // 2. Load prior context
        const priorContext = await Conversation.find({ instagram_id: senderId })
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();

        // 3. Greeting
        const userProfile = await getUserProfile(senderId);
        const patternGreeting = await generatePatternAwareGreeting(userProfile);

        // 4. Intent
        const intent = await parseIntent(messageText, priorContext);
        console.log("[Intent]", JSON.stringify(intent));

        let botResponse = "";
        let recommendationsReturned = [];

        if (intent.action === "recommend" && intent.type !== "unclear") {
            let results = [];
            if (intent.type === "restaurant") {
                results = await queryRestaurants(intent);
            } else if (intent.type === "event") {
                results = await queryEvents(intent);
            }

            if (results.length > 0) {
                const messages = await formatRecommendations(results, intent);
                if (patternGreeting) messages.unshift(patternGreeting);
                await sendMessageSequence(senderId, messages);
                botResponse = messages.join(" || ");
                recommendationsReturned = results;
                await updateUserPatterns(senderId, intent);
            } else {
                const fallback = "I couldn't find something that fits that perfectly yet. Want to try a nearby neighborhood or a different direction?";
                await sendMessage(senderId, fallback);
                botResponse = fallback;
            }
        } else if (intent.action === "clarify" || intent.action === "direct") {
            const question = intent.clarifyingQuestion || "Hey — tell me what you're in the mood for.";
            await sendMessage(senderId, question);
            botResponse = question;
        } else {
            const welcome = "Hey — tell me what you're in the mood for. Food, something happening tonight, or just an idea?";
            await sendMessage(senderId, welcome);
            botResponse = welcome;
        }

        // 6. Log
        await Conversation.create({
            instagram_id: senderId,
            raw_message: messageText,
            parsed_intent: intent,
            confidence_score: intent.confidenceScore,
            clarifying_question_sent: intent.action === "clarify" || intent.action === "direct",
            recommendations_returned: recommendationsReturned,
            bot_response: botResponse,
        });
    } catch (err) {
        console.error("[ProcessMessage] Error:", err);
        try {
            await sendMessage(senderId, "Something's shifting on my end. Give me one second.");
        } catch (msgErr) {
            console.error("[ProcessMessage] Failed to send error message:", msgErr);
        }
    }
}
