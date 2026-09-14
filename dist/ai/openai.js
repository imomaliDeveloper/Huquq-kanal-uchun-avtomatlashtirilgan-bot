"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiProvider = exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
class OpenAIProvider {
    openai = null;
    constructor() {
        if (env_1.env.AI_API_KEY) {
            try {
                this.openai = new openai_1.default({ apiKey: env_1.env.AI_API_KEY });
            }
            catch (err) {
                logger_1.logger.warn(`Failed to initialize OpenAI SDK: ${err.message}`);
            }
        }
    }
    async generateJson(systemPrompt, userPrompt) {
        if (!this.openai || !env_1.env.AI_API_KEY) {
            logger_1.logger.warn('No OpenAI API Key configured. Returning fallback legal test sample JSON.');
            return this.getFallbackMockJson();
        }
        try {
            const response = await this.openai.chat.completions.create({
                model: env_1.env.AI_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                response_format: { type: 'json_object' },
            });
            const content = response.choices[0]?.message?.content;
            if (!content)
                return null;
            return JSON.parse(content);
        }
        catch (error) {
            logger_1.logger.error(`OpenAI JSON Generation error: ${error.message}`);
            return null;
        }
    }
    async generateText(systemPrompt, userPrompt) {
        if (!this.openai || !env_1.env.AI_API_KEY) {
            return 'Professional legal concept background visual';
        }
        try {
            const response = await this.openai.chat.completions.create({
                model: env_1.env.AI_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
            });
            return response.choices[0]?.message?.content || '';
        }
        catch (error) {
            logger_1.logger.error(`OpenAI Text Generation error: ${error.message}`);
            return '';
        }
    }
    getFallbackMockJson() {
        return {
            topic: 'Mehnat huquqi',
            question: "Xodim ish beruvchidan o'z xohishiga ko'ra mehnat shartnomasini bekor qilish haqida necha kun oldin yozma ogohlantirishi kerak?",
            options: [
                '10 kun oldin',
                '2 hafta (14 kun) oldin',
                '1 oy oldin',
                '3 kun oldin',
            ],
            correct_answer: 1,
            explanation: "O'zbekiston Respublikasi Mehnat kodeksining 160-moddasiga ko'ra, xodim nomuayyan muddatga tuzilgan mehnat shartnomasini ikki hafta oldin yozma ravishda ogohlantirgan holda bekor qilishga haqli.",
            legal_source: "O'zbekiston Respublikasi Mehnat kodeksi, 160-modda",
            source_url: 'https://lex.uz/docs/-6257288',
        };
    }
}
exports.OpenAIProvider = OpenAIProvider;
exports.openaiProvider = new OpenAIProvider();
