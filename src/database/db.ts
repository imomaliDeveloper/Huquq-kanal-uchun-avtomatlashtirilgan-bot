import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { BASE_DIR } from '../config/env';
import { logger } from '../utils/logger';

const dataDir = path.join(BASE_DIR, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const prisma = new PrismaClient();

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    await prisma.$connect();
    
    // Auto-create tables if they don't exist in SQLite
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

    logger.info('✅ Database schema and SQLite tables (Test, Setting, Stat) verified/created successfully.');
  } catch (err: any) {
    logger.error(`Database auto-migration warning: ${err?.message || err}`);
  }
}
