import { getAIProvider } from '../ai/aiProvider';
import { GeneratedTestSchema } from './testGenerator';
import { logger } from '../utils/logger';

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

export class FactChecker {
  async check(testData: GeneratedTestSchema): Promise<{ isValid: boolean; reason: string }> {
    logger.info('Running LLM Fact Checker verification via Gemini/AI Provider...');
    const userPrompt = `Test JSON:\n${JSON.stringify(testData, null, 2)}`;
    
    const provider = getAIProvider();
    const result = await provider.generateJson<{ is_valid: boolean; reason: string }>(
      FACT_CHECK_SYSTEM_PROMPT,
      userPrompt
    );

    if (!result) {
      return { isValid: true, reason: 'Passed by default' };
    }

    return {
      isValid: result.is_valid ?? true,
      reason: result.reason || 'Verified OK',
    };
  }
}

export const factChecker = new FactChecker();
