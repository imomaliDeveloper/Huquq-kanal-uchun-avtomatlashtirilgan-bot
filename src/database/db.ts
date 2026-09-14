import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { BASE_DIR } from '../config/env';

const dataDir = path.join(BASE_DIR, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const prisma = new PrismaClient();
