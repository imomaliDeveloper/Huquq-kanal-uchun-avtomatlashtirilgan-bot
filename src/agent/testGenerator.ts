import { getAIProvider } from '../ai/aiProvider';
import { logger } from '../utils/logger';

export interface GeneratedTestSchema {
  topic: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  legal_source: string;
  source_url?: string;
}

const SYSTEM_PROMPT = `
Siz O‘zbekiston Respublikasi huquqi va qonunchiligi bo‘yicha tajribali senior huquqshunos hamda ekspert test tuzuvchisiz.

Vazifangiz: Berilgan huquqiy mavzu bo‘yicha O‘zbekiston Respublikasi qonunchiligiga to‘liq mos keladigan, amaliy va qiziqarli huquqiy test yaratish.

TALABLAR:
1. Til: O‘zbek tili (Lotin alifbosida). Grammatik va huquqiy terminlar jihatidan 100% to‘g‘ri bo‘lsin.
2. Savol formati: 
   - Real hayotiy vaziyat yoki amaliy huquqiy holat aks etsin.
   - 1 ta aniq savol, 4 ta variant (A, B, C, D), faqat 1 ta to‘g‘ri javob (indeks 0..3).
3. Huquqiy asos: O‘zbekiston Respublikasi Kodekslari yoki Qonunlaridan olingan aniq modda.
4. Javob JSON formati:
{
  "topic": "Mavzu nomi",
  "question": "Savol matni...",
  "options": ["A", "B", "C", "D"],
  "correct_answer": 0,
  "explanation": "Batafsil izoh...",
  "legal_source": "O‘zbekiston Respublikasi [Kodeks/Qonun nomi], [Modda]-moddasi",
  "source_url": "https://lex.uz/docs/..."
}
`;

export class TestGenerator {
  async generate(topic: string): Promise<GeneratedTestSchema | null> {
    const userPrompt = `Mavzu: ${topic}\n\nIltimos, ushbu mavzu bo'yicha bitta amaliy huquqiy test yaratib bering.`;
    logger.info(`Generating AI legal test for topic: '${topic}' using Gemini/AI Provider...`);
    
    const provider = getAIProvider();
    return await provider.generateJson<GeneratedTestSchema>(SYSTEM_PROMPT, userPrompt);
  }
}

export const testGenerator = new TestGenerator();
