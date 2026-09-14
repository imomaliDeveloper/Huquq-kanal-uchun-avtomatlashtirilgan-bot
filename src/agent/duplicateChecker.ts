import crypto from 'crypto';
import { repository } from '../database/schema';
import { logger } from '../utils/logger';

export function computeHash(text: string): string {
  const normalized = text.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function calculateSimilarity(s1: string, s2: string): number {
  const clean1 = s1.toLowerCase().replace(/[^\w\s]/gi, '');
  const clean2 = s2.toLowerCase().replace(/[^\w\s]/gi, '');
  
  const words1 = new Set(clean1.split(/\s+/));
  const words2 = new Set(clean2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  return (intersection.size / union.size) * 100;
}

export class DuplicateChecker {
  async isDuplicate(question: string, threshold: number = 80): Promise<{ isDup: boolean; reason: string }> {
    const questionHash = computeHash(question);

    // 1. Exact hash check
    const existing = await repository.getTestByHash(questionHash);
    if (existing) {
      logger.warn(`Exact hash duplicate detected: ${questionHash.substring(0, 8)}`);
      await repository.recordStat('duplicate_prevented');
      return { isDup: true, reason: `Exact hash match with Test #${existing.id}` };
    }

    // 2. Similarity check
    const pastQuestions = await repository.getAllQuestions(300);
    for (const past of pastQuestions) {
      const score = calculateSimilarity(question, past);
      if (score >= threshold) {
        logger.warn(`Semantic duplicate detected (${score.toFixed(1)}% similarity): '${question.substring(0, 40)}...'`);
        await repository.recordStat('duplicate_prevented');
        return { isDup: true, reason: `Semantic duplicate match (${score.toFixed(1)}%)` };
      }
    }

    return { isDup: false, reason: 'Unique question verified' };
  }
}

export const duplicateChecker = new DuplicateChecker();
