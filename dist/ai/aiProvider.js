"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIProvider = getAIProvider;
const env_1 = require("../config/env");
const gemini_1 = require("./gemini");
const openai_1 = require("./openai");
function getAIProvider() {
    const provider = env_1.env.AI_PROVIDER.toLowerCase();
    if (provider === 'openai') {
        return openai_1.openaiProvider;
    }
    // Default to Gemini Provider
    return gemini_1.geminiProvider;
}
