import { env } from '../config/env';
import { geminiProvider } from './gemini';
import { openaiProvider } from './openai';

export interface AIProvider {
  generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T | null>;
  generateText(systemPrompt: string, userPrompt: string): Promise<string>;
}

export function getAIProvider(): AIProvider {
  const provider = env.AI_PROVIDER.toLowerCase();
  if (provider === 'openai') {
    return openaiProvider;
  }
  // Default to Gemini Provider
  return geminiProvider;
}
