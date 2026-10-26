"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const axios_1 = __importDefault(require("axios"));
const node_cron_1 = __importDefault(require("node-cron"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const db_1 = require("./database/db");
const bot_1 = require("./bot/bot");
const scheduler_1 = require("./scheduler/scheduler");
async function main() {
    logger_1.logger.info('Starting Node.js + TypeScript AI Autonomous Legal Content Telegram Agent...');
    // 1. Auto-create database tables (Channel, Test, Setting, Stat) if not existing
    await (0, db_1.ensureDatabaseSchema)();
    // 2. Initialize Telegram Bot
    let bot = null;
    try {
        bot = await (0, bot_1.initBot)();
    }
    catch (err) {
        logger_1.logger.error(`Bot initialization failed: ${err?.message || err}`);
    }
    // 3. Start node-cron Scheduler
    try {
        await scheduler_1.scheduler.start();
        logger_1.logger.info('node-cron Scheduler initialized.');
    }
    catch (err) {
        logger_1.logger.error(`Scheduler startup failed: ${err?.message || err}`);
    }
    // 4. Render Keep-Alive HTTP Health Server (Prevents Render Free Tier from Sleeping)
    const port = process.env.PORT || 3000;
    const server = http_1.default.createServer((req, res) => {
        if (req.url === '/' || req.url === '/ping' || req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                service: 'Legal AI Content Agent',
                bot: '@Huquqchi_bot',
                channel: '@Huquq_study',
                uptimeSeconds: Math.floor(process.uptime()),
                timestamp: new Date().toISOString(),
            }));
        }
        else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger_1.logger.warn(`Port ${port} band bo'lganligi sababli HTTP server boshqa portda yoki bot fonida davom etmoqda.`);
        }
        else {
            logger_1.logger.error(`HTTP server xatosi: ${err?.message || err}`);
        }
    });
    try {
        server.listen(port, () => {
            logger_1.logger.info(`🌐 Render Keep-Alive HTTP Server listening on port ${port}`);
        });
    }
    catch (err) {
        logger_1.logger.warn(`Could not listen on port ${port}: ${err?.message || err}`);
    }
    // 5. Auto Self-Ping Interval (Pings service every 5 minutes to prevent spin-down)
    const renderExternalUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            const pingUrl = `${renderExternalUrl.replace(/\/$/, '')}/ping`;
            await axios_1.default.get(pingUrl, { timeout: 10000 });
            logger_1.logger.info(`🔄 Auto-ping self keep-alive request sent to ${pingUrl}`);
        }
        catch (err) {
            logger_1.logger.warn(`Auto-ping self keep-alive attempt failed: ${err?.message || err}`);
        }
    });
    if (!bot || !env_1.env.BOT_TOKEN) {
        logger_1.logger.warn('⚠️ BOT_TOKEN is missing in environment variables. Bot polling skipped, HTTP server remains active.');
        return;
    }
    // 6. Start Bot Polling
    logger_1.logger.info('Starting grammY Bot Polling...');
    try {
        await bot.start({
            onStart: (info) => {
                logger_1.logger.info(`Bot @${info.username} is running and listening for commands!`);
            },
        });
    }
    catch (err) {
        logger_1.logger.error(`Bot start polling failed: ${err?.message || err}`);
    }
}
main().catch((err) => {
    console.error('Fatal application startup error:', err);
    logger_1.logger.error(`Fatal application startup error: ${err?.stack || err?.message || err}`);
    process.exit(1);
});
