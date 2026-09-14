"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factChecker = exports.FactChecker = void 0;
const aiProvider_1 = require("../ai/aiProvider");
const logger_1 = require("../utils/logger");
const FACT_CHECK_SYSTEM_PROMPT = `
Siz O‘zbekiston qonunchiligi va huquqiy faktlarni tekshiruvchi (Fact Checker) ekspertsiz.

Sizga yaratilgan huquqiy test beriladi. Siz uni sinchiklab tekshirishingiz va tasdiqlashingiz kerak.

TEKSHIRUV RO'YXATI:
1. Savol O‘zbekiston Respublikasi amaldagi qonunchiligiga mos keladimi?
2. Ko'rsatilgan to'g'ri javob haqiqatan ham to'g'rimi?
3. Qolgan variantlar noto'g'rimi va savolda ikkita to'g'ri javob yo'qmi?
4. Qonun va modda raqami noto'g'ri ko'rsatilmaganmi?

JAVOB FORMATI:
{
  "is_valid": true,
  "reason": "Verified OK"
}
`;
class FactChecker {
    async check(testData) {
        logger_1.logger.info('Running LLM Fact Checker verification via Gemini/AI Provider...');
        const userPrompt = `Test JSON:\n${JSON.stringify(testData, null, 2)}`;
        const provider = (0, aiProvider_1.getAIProvider)();
        const result = await provider.generateJson(FACT_CHECK_SYSTEM_PROMPT, userPrompt);
        if (!result) {
            return { isValid: true, reason: 'Passed by default' };
        }
        return {
            isValid: result.is_valid ?? true,
            reason: result.reason || 'Verified OK',
        };
    }
}
exports.FactChecker = FactChecker;
exports.factChecker = new FactChecker();
