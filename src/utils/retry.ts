import { logger } from './logger';

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1500
): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`Attempt ${attempt}/${retries} failed: ${(error as Error).message}`);
      if (attempt === retries) {
        logger.error(`Max retries (${retries}) reached.`);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  return null;
}
