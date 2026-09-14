import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from '../config/env';
import { commandsComposer } from './commands';
import { adminComposer } from './admin';
import { logger } from '../utils/logger';

let botInstance: Bot | null = null;

export function getBot(): Bot | null {
  if (!botInstance && env.BOT_TOKEN) {
    try {
      botInstance = new Bot(env.BOT_TOKEN);
      botInstance.use(commandsComposer);
      botInstance.use(adminComposer);

      // Register Global Error Handler to prevent process crashes
      botInstance.catch((err) => {
        const ctx = err.ctx;
        logger.error(`Error while handling update ${ctx.update.update_id}:`);
        const e = err.error;
        if (e instanceof GrammyError) {
          logger.error(`Error in request: ${e.description}`);
        } else if (e instanceof HttpError) {
          logger.error(`Could not contact Telegram: ${e}`);
        } else {
          logger.error(`Unknown error: ${(e as Error).message}`);
        }
      });
    } catch (error) {
      logger.error(`Failed to initialize grammY Bot: ${(error as Error).message}`);
    }
  }
  return botInstance;
}

export async function initBot(): Promise<Bot | null> {
  const bot = getBot();
  if (bot && env.BOT_TOKEN) {
    logger.info('Bot composers and global error handler attached successfully.');
  }
  return bot;
}
