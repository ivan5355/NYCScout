/**
 * NYC Scout — Root Health Check Handler
 */

module.exports = (req, res) => {
    res.json({
        status: "ok",
        service: "NYC Scout",
        description: "DM-native Instagram concierge for NYC recommendations",
    });
};
