/**
 * Local Express development server.
 * In production, Vercel serverless handles requests via api/webhook.js.
 */

require("dotenv").config();

const express = require("express");
const webhookHandler = require("./api/webhook");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON body and preserve raw body for signature verification
app.use(
    express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    })
);

// Route webhook traffic
app.all("/api/webhook", (req, res) => webhookHandler(req, res));

// Health check
app.get("/", (_req, res) => {
    res.json({
        status: "ok",
        service: "NYC Scout",
        description: "DM-native Instagram concierge for NYC recommendations",
    });
});

app.listen(PORT, () => {
    console.log(`\n🏙️  NYC Scout is running on http://localhost:${PORT}`);
    console.log(`📩  Webhook URL: http://localhost:${PORT}/api/webhook\n`);
});
