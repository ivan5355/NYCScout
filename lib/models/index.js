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
        // goodrec database
        Event: dbs.goodrec.models.Event || dbs.goodrec.model("Event", eventSchema),

        // nyc database (where 250 restaurants live)
        Restaurant: dbs.nyc.models.Restaurant || dbs.nyc.model("Restaurant", restaurantSchema),
        User: dbs.nycEvents.models.User || dbs.nycEvents.model("User", userSchema),
        UserLimit: dbs.nycEvents.models.UserLimit || dbs.nycEvents.model("UserLimit", userLimitSchema),
        Conversation: dbs.nycEvents.models.Conversation || dbs.nycEvents.model("Conversation", conversationSchema),
    };
}

module.exports = { getModels };
