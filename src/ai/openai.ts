import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AIProvider } from './aiProvider';

export class OpenAIProvider implements AIProvider {
  private openai: OpenAI | null = null;

  constructor() {
    if (env.AI_API_KEY) {
      try {
        this.openai = new OpenAI({ apiKey: env.AI_API_KEY });
      } catch (err) {
        logger.warn(`Failed to initialize OpenAI SDK: ${(err as Error).message}`);
      }
    }
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T | null> {
    if (!this.openai || !env.AI_API_KEY) {
      logger.warn('No OpenAI API Key configured. Returning fallback legal test sample JSON.');
      return this.getFallbackMockJson() as unknown as T;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: env.AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      return JSON.parse(content) as T;
    } catch (error) {
      logger.error(`OpenAI JSON Generation error: ${(error as Error).message}`);
      return null;
    }
  }

  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.openai || !env.AI_API_KEY) {
      return 'Professional legal concept background visual';
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: env.AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error(`OpenAI Text Generation error: ${(error as Error).message}`);
      return '';
    }
  }

  private getFallbackMockJson() {
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

export const openaiProvider = new OpenAIProvider();
