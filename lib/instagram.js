/**
 * Instagram Graph API helpers for sending DMs.
 * Uses the Page Access Token to send messages via the Instagram Messaging API.
 */

const PAGE_ACCESS_TOKEN = () => process.env.PAGE_ACCESS_TOKEN;

/**
 * Send a single text message to an Instagram user.
 * @param {string} recipientId - Instagram-scoped user ID (IGSID)
 * @param {string} text - message text
 */
async function sendMessage(recipientId, text) {
    const url = `https://graph.facebook.com/v21.0/me/messages`;
    const token = PAGE_ACCESS_TOKEN();

    // Debug: log token info (not the full token for security)
    console.log("[Instagram] Token length:", token?.length, "| Starts with:", token?.substring(0, 10), "| Ends with:", token?.substring(token.length - 5));

    const body = {
        recipient: { id: recipientId },
        message: { text },
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error("[Instagram] Send failed:", res.status, err);
        throw new Error(`Instagram send failed: ${res.status}`);
    }

    return res.json();
}

/**
 * Send multiple messages sequentially with pacing delays.
 * Design.md: 400-900ms delay between multi-message outputs.
 * @param {string} recipientId
 * @param {string[]} messages
 */
async function sendMessageSequence(recipientId, messages) {
    for (let i = 0; i < messages.length; i++) {
        await sendMessage(recipientId, messages[i]);

        // Pacing: 400-900ms delay between messages (design.md Section 6)
        if (i < messages.length - 1) {
            const delay = 400 + Math.random() * 500;
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}

module.exports = { sendMessage, sendMessageSequence };
