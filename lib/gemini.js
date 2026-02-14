const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;

function getModel() {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });
}

// ─── System prompt encodes the entire design.md tone & masterplan intent rules ──
const SYSTEM_PROMPT = `You are NYC Scout — a calm, editorially-voiced concierge that lives inside Instagram DMs.

PERSONALITY
- Measured, observant, kind, understated. Never salesy. No hype language, no all-caps, no urgency.
- Speak like a thoughtful NYC friend texting at 6pm — grounded, unhurried, genuinely invested.

RULES
1. Parse the user's free-form message and extract:
   - type: "restaurant" | "event" | "unclear"
   - cuisine or event category (if present)
   - borough or neighborhood (if present)
   - price signal (if present)
   - vibe signal (if present)
   - date/time intent (if present)
   - confidenceScore: 0.0–1.0

2. Confidence logic:
   - >= 0.7 → ready to recommend (set action = "recommend")
   - 0.4–0.69 → ask ONE clarifying question (set action = "clarify")
   - < 0.4 → ask ONE directional question (set action = "direct")
   NEVER ask more than one question.

3. If action is "clarify" or "direct", generate a warm, short question (1-2 sentences). Examples:
   - "Are you thinking Manhattan, or open to Brooklyn too?"
   - "I can work with that — are you thinking food, or something happening?"

4. Output ONLY valid JSON (no markdown fences, no extra text):
{
  "type": "restaurant" | "event" | "unclear",
  "cuisine": "string or null",
  "category": "string or null",
  "borough": "string or null",
  "neighborhood": "string or null",
  "priceIntent": "string or null",
  "vibeSignal": "string or null",
  "dateIntent": "string or null",
  "confidenceScore": 0.0-1.0,
  "action": "recommend" | "clarify" | "direct",
  "clarifyingQuestion": "string or null"
}`;

/**
 * Parse a user's DM to extract intent via Gemini.
 * @param {string} message - raw user message
 * @param {Array} priorContext - last 3 conversations (optional)
 * @returns {object} parsed intent JSON
 */
async function parseIntent(message, priorContext = []) {
    const model = getModel();

    let contextBlock = "";
    if (priorContext.length > 0) {
        const summaries = priorContext.map(
            (c) =>
                `User said: "${c.raw_message}" → Bot responded with: ${c.bot_response || "N/A"}`
        );
        contextBlock = `\n\nPRIOR CONVERSATION CONTEXT (last ${priorContext.length}):\n${summaries.join("\n")}`;
    }

    const prompt = `${SYSTEM_PROMPT}${contextBlock}\n\nUSER MESSAGE:\n"${message}"`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip potential markdown fences
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
        return JSON.parse(cleaned);
    } catch (err) {
        console.error("[Gemini] Failed to parse JSON:", text);
        return {
            type: "unclear",
            confidenceScore: 0.3,
            action: "direct",
            clarifyingQuestion:
                "Hey — tell me what you're in the mood for. Food, something happening tonight, or just an idea?",
        };
    }
}

// ─── Format recommendations in the design.md editorial voice ──

const FORMAT_PROMPT = `You are NYC Scout. Format the following recommendations for an Instagram DM.

FORMATTING RULES:
- Each recommendation is its own message (separated by |||)
- Start with a calm framing line as the FIRST message
- For restaurants: Name, 1-2 sentence summary, why it fits, address, price tier
- For events: Name, 1-2 sentence summary, why it fits, date/time, price, link
- End with a FINAL message: "Want to refine this, or shift the vibe?"
- 1-3 sentences per message. Never dense paragraphs.
- Tone: editorial, kind, understated. NO hype, NO all-caps, NO urgency, NO emoji overload.
- Never exceed 3 recommendations. If uncertain return 2.
- Separate each distinct message with |||

Example output:
Here are a few that feel right.|||Tatiana — A Caribbean-influenced spot in Prospect Heights that keeps things creative without being fussy. It fits the relaxed, slightly adventurous mood you're going for. 649 Classon Ave, Brooklyn. $$.|||Want to refine this, or shift the vibe?`;

/**
 * Format raw DB results into editorial DM messages.
 * @param {Array} items - restaurant or event documents
 * @param {object} intent - parsed intent from Gemini
 * @returns {string[]} Array of message strings to send sequentially
 */
async function formatRecommendations(items, intent) {
    if (!items || items.length === 0) {
        return [
            "I couldn't find something that fits that perfectly yet. Want to try a nearby neighborhood or shift the vibe a little?",
        ];
    }

    const model = getModel();

    const itemDescriptions = items
        .map((item, i) => {
            if (intent.type === "restaurant" || item.address) {
                return `${i + 1}. Name: ${item.name} | Cuisine: ${(item.cuisine_tags || []).join(", ")} | Borough: ${item.borough} | Neighborhood: ${item.neighborhood || "N/A"} | Address: ${item.address} | Price: ${item.price_tier} | Vibe: ${(item.vibe_tags || []).join(", ")}`;
            } else {
                return `${i + 1}. Name: ${item.name} | Category: ${item.category} | Borough: ${item.borough} | Date: ${item.date_time} | Price: ${item.price} | Link: ${item.link} | Vibe: ${(item.vibe_tags || []).join(", ")}`;
            }
        })
        .join("\n");

    const userContext = `The user asked for: "${intent.vibeSignal || ""} ${intent.cuisine || intent.category || ""} in ${intent.borough || "NYC"}".`;

    const prompt = `${FORMAT_PROMPT}\n\n${userContext}\n\nRECOMMENDATIONS DATA:\n${itemDescriptions}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Split into separate messages
    const messages = text
        .split("|||")
        .map((m) => m.trim())
        .filter((m) => m.length > 0);

    return messages.length > 0
        ? messages
        : ["Here are a few that feel right.", text];
}

/**
 * Generate a personalized greeting for repeat users based on their patterns.
 */
async function generatePatternAwareGreeting(userProfile) {
    if (!userProfile || userProfile.interaction_count < 3) return null;

    // Find strongest borough tendency
    let topBorough = null;
    let topCount = 0;
    if (userProfile.borough_tendency) {
        for (const [borough, count] of userProfile.borough_tendency) {
            if (count > topCount) {
                topBorough = borough;
                topCount = count;
            }
        }
    }

    // Find strongest cuisine preference
    let topCuisine = null;
    let topCuisineCount = 0;
    if (userProfile.cuisine_preferences) {
        for (const [cuisine, count] of userProfile.cuisine_preferences) {
            if (count > topCuisineCount) {
                topCuisine = cuisine;
                topCuisineCount = count;
            }
        }
    }

    if (!topBorough && !topCuisine) return null;

    const model = getModel();
    const prompt = `You are NYC Scout. Generate a SINGLE short, warm, contextual greeting (1 sentence) for a repeat user.

Their tendencies: ${topBorough ? `They lean toward ${topBorough}.` : ""} ${topCuisine ? `They often ask about ${topCuisine}.` : ""}

Rules:
- Never say "based on your data" or "your history shows"
- Be gently contextual, like a friend who remembers
- Example: "You've leaned toward Brooklyn live music before — want something similar?"
- Output ONLY the greeting text, nothing else.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}

module.exports = { parseIntent, formatRecommendations, generatePatternAwareGreeting };
