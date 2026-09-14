"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = withRetry;
const logger_1 = require("./logger");
async function withRetry(fn, retries = 3, delayMs = 1500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            logger_1.logger.warn(`Attempt ${attempt}/${retries} failed: ${error.message}`);
            if (attempt === retries) {
                logger_1.logger.error(`Max retries (${retries}) reached.`);
                return null;
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
    }
    return null;
}
