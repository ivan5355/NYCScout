const restaurantSchema = require("./Restaurant");
const eventSchema = require("./Event");
const userSchema = require("./User");
const userLimitSchema = require("./UserLimit");
const conversationSchema = require("./Conversation");

/**
 * Returns models bound to their respective databases.
 * @param {object} dbs - The dbs object returned by connectDB()
 */
function getModels(dbs) {
    return {
        // NYC_SCOUT database
        Event: dbs.nycScout.models.Event || dbs.nycScout.model("Event", eventSchema),
        Restaurant: dbs.nycScout.models.Restaurant || dbs.nycScout.model("Restaurant", restaurantSchema),
        User: dbs.nycScout.models.User || dbs.nycScout.model("User", userSchema),
        UserLimit: dbs.nycScout.models.UserLimit || dbs.nycScout.model("UserLimit", userLimitSchema),
        Conversation: dbs.nycScout.models.Conversation || dbs.nycScout.model("Conversation", conversationSchema),
    };
}

module.exports = { getModels };
