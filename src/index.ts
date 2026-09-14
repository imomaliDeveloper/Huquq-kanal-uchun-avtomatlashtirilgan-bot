import http from 'http';
import axios from 'axios';
import cron from 'node-cron';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './database/db';
import { initBot } from './bot/bot';
import { scheduler } from './scheduler/scheduler';

async function main() {
  logger.info('Starting Node.js + TypeScript AI Autonomous Legal Content Telegram Agent...');

  // 1. Database connection check
  try {
    await prisma.$connect();
    logger.info('Prisma SQLite Database connected successfully.');
  } catch (err) {
    logger.error(`Database connection failed: ${(err as Error).message}`);
  }

  // 2. Initialize Telegram Bot
  const bot = await initBot();

  // 3. Start node-cron Scheduler
  await scheduler.start();
  logger.info('node-cron Scheduler initialized.');

  // 4. Render Keep-Alive HTTP Health Server (Prevents Render Free Tier from Sleeping)
  const port = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/ping' || req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'Legal AI Content Agent',
          bot: '@Huquqchi_bot',
          channel: '@Huquq_study',
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    logger.info(`🌐 Render Keep-Alive HTTP Server listening on port ${port}`);
  });

  // 5. Auto Self-Ping Interval (Pings service every 5 minutes to prevent spin-down)
  const renderExternalUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  cron.schedule('*/5 * * * *', async () => {
    try {
      const pingUrl = `${renderExternalUrl.replace(/\/$/, '')}/ping`;
      await axios.get(pingUrl, { timeout: 10000 });
      logger.info(`🔄 Auto-ping self keep-alive request sent to ${pingUrl}`);
    } catch (err) {
      logger.warn(`Auto-ping self keep-alive attempt failed: ${(err as Error).message}`);
    }
  });

  if (!bot || !env.BOT_TOKEN) {
    logger.warn('BOT_TOKEN is missing in .env. Bot polling skipped.');
    return;
  }

  // 6. Start Bot Polling
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
