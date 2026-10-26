import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { BASE_DIR, env } from '../config/env';
import { logger } from '../utils/logger';

const dataDir = path.join(BASE_DIR, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqliteFilePath = path.resolve(dataDir, 'legal_agent.db').replace(/\\/g, '/');
const fallbackDbUrl = `file:${sqliteFilePath}`;

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = fallbackDbUrl;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || fallbackDbUrl,
    },
  },
});

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    await prisma.$connect();
    
    // Auto-create tables if they don't exist in SQLite
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Channel" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "channelId" TEXT UNIQUE NOT NULL,
        "title" TEXT NOT NULL DEFAULT '',
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
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

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Setting" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Stat" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "metricName" TEXT NOT NULL,
        "metricValue" INTEGER NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Auto-seed default channel if empty and env.CHANNEL_ID is provided
    try {
      const channelCount = await prisma.channel.count();
      if (channelCount === 0 && env.CHANNEL_ID) {
        await prisma.channel.create({
          data: {
            channelId: env.CHANNEL_ID,
            title: env.CHANNEL_ID,
            isActive: true,
          },
        });
        logger.info(`Initial default channel '${env.CHANNEL_ID}' registered in database.`);
      }
    } catch (e: any) {
      logger.warn(`Could not seed initial channel: ${e?.message || e}`);
    }

    logger.info('✅ Database schema and SQLite tables (Channel, Test, Setting, Stat) verified/created successfully.');
  } catch (err: any) {
    logger.error(`Database auto-migration warning: ${err?.message || err}`);
  }
}
