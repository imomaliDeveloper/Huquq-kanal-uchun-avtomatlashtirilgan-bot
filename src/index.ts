import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './database/db';
import { initBot } from './bot/bot';
import { scheduler } from './scheduler/scheduler';

async function main() {
  logger.info('Starting Node.js + TypeScript AI Autonomous Legal Content Telegram Agent...');

  // 1. Check Database connection
  try {
    await prisma.$connect();
    logger.info('Prisma SQLite Database connected successfully.');
  } catch (err) {
    logger.error(`Database connection failed: ${(err as Error).message}`);
  }

  // 2. Initialize Bot
  const bot = await initBot();

  // 3. Start Scheduler
  await scheduler.start();
  logger.info('node-cron Scheduler initialized.');

  if (!bot || !env.BOT_TOKEN) {
    logger.warn('BOT_TOKEN is missing in .env. Bot polling skipped.');
    return;
  }

  // 4. Start Bot Polling
  logger.info('Starting grammY Bot Polling...');
  bot.start({
    onStart: (info) => {
      logger.info(`Bot @${info.username} is running and listening for commands!`);
    },
  });
}

main().catch((err) => {
  logger.error(`Fatal application startup error: ${err.message}`);
  process.exit(1);
});
