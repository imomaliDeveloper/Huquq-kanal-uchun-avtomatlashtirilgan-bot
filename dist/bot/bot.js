"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBot = getBot;
exports.initBot = initBot;
const grammy_1 = require("grammy");
const env_1 = require("../config/env");
const commands_1 = require("./commands");
const admin_1 = require("./admin");
const logger_1 = require("../utils/logger");
let botInstance = null;
function getBot() {
    if (!botInstance && env_1.env.BOT_TOKEN) {
        try {
            botInstance = new grammy_1.Bot(env_1.env.BOT_TOKEN);
            botInstance.use(commands_1.commandsComposer);
            botInstance.use(admin_1.adminComposer);
            // Register Global Error Handler to prevent process crashes
            botInstance.catch((err) => {
                const ctx = err.ctx;
                logger_1.logger.error(`Error while handling update ${ctx.update.update_id}:`);
                const e = err.error;
                if (e instanceof grammy_1.GrammyError) {
                    logger_1.logger.error(`Error in request: ${e.description}`);
                }
                else if (e instanceof grammy_1.HttpError) {
                    logger_1.logger.error(`Could not contact Telegram: ${e}`);
                }
                else {
                    logger_1.logger.error(`Unknown error: ${e.message}`);
                }
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to initialize grammY Bot: ${error.message}`);
        }
    }
    return botInstance;
}
async function initBot() {
    const bot = getBot();
    if (bot && env_1.env.BOT_TOKEN) {
        logger_1.logger.info('Bot composers and global error handler attached successfully.');
    }
    return bot;
}
