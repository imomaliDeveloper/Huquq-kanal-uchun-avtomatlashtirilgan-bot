"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.ensureDatabaseSchema = ensureDatabaseSchema;
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const dataDir = path_1.default.join(env_1.BASE_DIR, 'data');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
exports.prisma = new client_1.PrismaClient();
async function ensureDatabaseSchema() {
    try {
        await exports.prisma.$connect();
        // Auto-create tables if they don't exist in SQLite
        await exports.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Channel" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "channelId" TEXT UNIQUE NOT NULL,
        "title" TEXT NOT NULL DEFAULT '',
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
        await exports.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Test" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "topic" TEXT NOT NULL,
        "question" TEXT NOT NULL,
        "questionHash" TEXT UNIQUE NOT NULL,
        "optionA" TEXT NOT NULL,
        "optionB" TEXT NOT NULL,
        "optionC" TEXT NOT NULL,
        "optionD" TEXT NOT NULL,
        "correctAnswer" INTEGER NOT NULL,
        "explanation" TEXT NOT NULL,
        "legalSource" TEXT NOT NULL,
        "sourceUrl" TEXT DEFAULT '',
        "imagePath" TEXT DEFAULT '',
        "telegramMessageId" INTEGER,
        "telegramPollId" TEXT,
        "isAuto" BOOLEAN NOT NULL DEFAULT 1,
        "status" TEXT NOT NULL DEFAULT 'published',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "postedAt" DATETIME
      );
    `);
        await exports.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Setting" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL
      );
    `);
        await exports.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Stat" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "metricName" TEXT NOT NULL,
        "metricValue" INTEGER NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Auto-seed default channel if empty and env.CHANNEL_ID is provided
        try {
            const channelCount = await exports.prisma.channel.count();
            if (channelCount === 0 && env_1.env.CHANNEL_ID) {
                await exports.prisma.channel.create({
                    data: {
                        channelId: env_1.env.CHANNEL_ID,
                        title: env_1.env.CHANNEL_ID,
                        isActive: true,
                    },
                });
                logger_1.logger.info(`Initial default channel '${env_1.env.CHANNEL_ID}' registered in database.`);
            }
        }
        catch (e) {
            logger_1.logger.warn(`Could not seed initial channel: ${e?.message || e}`);
        }
        logger_1.logger.info('✅ Database schema and SQLite tables (Channel, Test, Setting, Stat) verified/created successfully.');
    }
    catch (err) {
        logger_1.logger.error(`Database auto-migration warning: ${err?.message || err}`);
    }
}
