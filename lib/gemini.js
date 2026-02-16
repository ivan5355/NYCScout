const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;

function getModel() {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite });
    }

// ─── System prompt encodes the entire design.md tone & masterplan intent rules ──
const SYSTEM_PROMPT = `You are NYC Scout — a calm, editorially-voiced concierge that lives inside Instagram DMs.

PERSONALITY & TONE
- Measured, observant, kind, understated. Never salesy. No hype, no all-caps, no urgency.
- NEVER use emojis. Keep it clean and text-only.

RULES
1. Parse the user's message and extract: type (restaurant/event/unclear), cuisine/category, borough, price, date.
2. Broad Searches:
   - If the user says "New York", "anywhere", "I don't care", or doesn't specify a borough after being asked, set borough = "Citywide" and proceed to recommend.
   - DO NOT loop clarification questions. If the user has provided a category (e.g. "events") but no borough, and responds broadly, move to recommendation (confidence >= 0.7).
3. Handle Critiques & Rejections: 
   - If the user says "no", "stop", "wrong", or "try something else", set action = "direct" and ask what they'd like to change.
4. Confidence logic:
   - >= 0.7 → action = "recommend". This is reached if you have:
     - Type + Cuisine/Category + ANY location (including "Citywide").
     - Even if borough is missing, if the user is being brief (e.g. just "mexican"), you can clarify ONCE, but if they are still broad, proceed city-wide.
   - 0.4-0.69 → action = "clarify" (ask for the borough if missing). NEVER ask the same question twice in a row.
   - < 0.4 → action = "direct".

5. Context:
   - Use PRIOR CONTEXT to remember what was already discussed.
   - If a user says "yes" to a clarification like "Are you still looking for events in Manhattan?", they have confirmed the filters. Set action = "recommend" and confidence >= 0.7.

6. Output ONLY valid JSON:
{
  "type": "restaurant" | "event" | "unclear",
  "cuisine": "string or null",
  "category": "string or null",
  "borough": "string or null",
  "priceIntent": "string or null",
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
            const summaries = priorContext.map((c) => {
                const intent = c.parsed_intent || {};
                const filters = [
                    intent.type ? `type=${intent.type}` : null,
                    intent.cuisine ? `cuisine=${intent.cuisine}` : null,
                    intent.category ? `category=${intent.category}` : null,
                    intent.borough ? `borough=${intent.borough}` : null,
                    intent.priceIntent ? `price=${intent.priceIntent}` : null,

                    intent.dateIntent ? `date=${intent.dateIntent}` : null,
                ].filter(Boolean).join(", ");
                return `User said: "${c.raw_message}" → Filters gathered so far: [${filters}] → Bot responded: ${c.bot_response || "N/A"}`;
            });
            contextBlock = `\n\nPRIOR CONVERSATION CONTEXT (oldest first):\n${summaries.reverse().join("\n")}`;
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
- Start with a calm framing line as the FIRST message.
- For EACH recommendation (restaurant or event), provide TWO messages:
  1. The Details: 
     - Restaurants: Name — Summary. Why it fits. Address, price tier.
     - Events: Name — Summary. Why it fits. Date/time, price, link.
  2. The Hook ("Why You Should Go"): 
     - A separate, warm, editorial message (1-2 sentences) explaining why this specific spot or event is worth the trip.
     - Draw from these themes naturally:
        * Community & Connection — meeting people or the "vibe" of the room.
        * Cultural Enrichment — unique flavors, history, or artistic tradition.
        * Supporting Local — neighborhood gems, independent venues, or culinary craft.
        * Personal Discovery — a new corner of the city or a hidden find.
     - NO labels like "Why You Should Go" or "Hook" — just write it naturally.
- End with a FINAL message: "Want to refine this, or try a different direction?"
- 1-3 sentences per message. Never dense paragraphs.
- STRICT: NO labels like "Event:", "Name:", "Category:", or "Location:". Just the content.
- Tone: editorial, kind, understated. NO emojis.
- Never exceed 2 recommendations (max 5 messages total including framing and final) to keep the DM clean.
- Separate each distinct message with |||`;

    /**
     * Format raw DB results into editorial DM messages.
     * @param {Array} items - restaurant or event documents
     * @param {object} intent - parsed intent from Gemini
     * @returns {string[]} Array of message strings to send sequentially
     */
    async function formatRecommendations(items, intent) {
        if (!items || items.length === 0) {
            return [
                "I couldn't find something that fits that perfectly yet. Want to try a different borough or direction?",
            ];
        }

        const model = getModel();

        const itemDescriptions = items
            .map((item, i) => {
                if (intent.type === "restaurant" || item.fullAddress) {
                    return `${i + 1}. Name: ${item.Name || item.name} | Cuisine: ${item.cuisineDescription || item.cuisine || "N/A"} | Address: ${item.fullAddress || "N/A"} | Price: ${item.priceLevel || "N/A"}`;
                } else {
                    return `${i + 1}. Name: ${item.name} | Category: ${item.category} | Location: ${item.location || "N/A"} | Date: ${item.date} | Time: ${item.time || "N/A"} | Price: ${item.price} | Link: ${item.link}`;
                }
            })
            .join("\n");

        const userContext = `The user asked for: "${intent.cuisine || intent.category || ""} in ${intent.borough || "NYC"}".`;

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
    async function generatePatternAwareGreeting(userProfile, currentIntent) {
        if (!userProfile || userProfile.interaction_count < 3) return null;

        // Find strongest tendencies
        let topBorough = null;
        let topCuisine = null;

        if (userProfile.borough_tendency) {
            const entries = userProfile.borough_tendency instanceof Map ? userProfile.borough_tendency.entries() : Object.entries(userProfile.borough_tendency);
            let max = 0;
            for (const [k, v] of entries) { if (v > max) { max = v; topBorough = k; } }
        }
        if (userProfile.cuisine_preferences) {
            const entries = userProfile.cuisine_preferences instanceof Map ? userProfile.cuisine_preferences.entries() : Object.entries(userProfile.cuisine_preferences);
            let max = 0;
            for (const [k, v] of entries) { if (v > max) { max = v; topCuisine = k; } }
        }

        // AVOID HALLUCINATION: If current intent matches history, acknowledge it.
        // If it conflicts (e.g., user asking for Mexican but history is Italian), stay neutral.
        const isNewCuisine = currentIntent?.cuisine && topCuisine && currentIntent.cuisine.toLowerCase() !== topCuisine.toLowerCase();

        const model = getModel();
        const prompt = `You are NYC Scout. Generate a SINGLE short, warm, contextual greeting (1 sentence).
    
    User history: ${topBorough ? `Likes ${topBorough}.` : ""} ${topCuisine ? `Often asks for ${topCuisine}.` : ""}
    Current request: ${currentIntent?.cuisine ? `Asking for ${currentIntent.cuisine}.` : "General request."}
    
    Rules:
    - If the current request is for a DIFFERENT cuisine than history, do NOT mention the old cuisine.
    - If the current request matches history, say something like "Back for more [cuisine], I see."
    - Tone: unhurried friend. NO emojis. 
    - Output ONLY the greeting text.`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    }

    module.exports = { parseIntent, formatRecommendations, generatePatternAwareGreeting };
