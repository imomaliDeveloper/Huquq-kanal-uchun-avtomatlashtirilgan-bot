import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const normalizeChannelId = (val: string) => {
  if (!val) return '';
  let cleaned = val.trim();
  if (cleaned.startsWith('https://t.me/')) {
    cleaned = '@' + cleaned.replace('https://t.me/', '');
  } else if (cleaned.startsWith('t.me/')) {
    cleaned = '@' + cleaned.replace('t.me/', '');
  } else if (!cleaned.startsWith('@') && !cleaned.startsWith('-')) {
    cleaned = '@' + cleaned;
  }
  return cleaned;
};

const envSchema = z.object({
  BOT_TOKEN: z.string().default(''),
  CHANNEL_ID: z.string().transform(normalizeChannelId).default(''),
  ADMIN_ID: z.coerce.number().default(0),

  AI_PROVIDER: z.string().default('gemini'),
  AI_API_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('gemini-3.6-flash'),

  IMAGE_PROVIDER: z.string().default('pollinations'),
  IMAGE_API_KEY: z.string().default(''),

  POST_INTERVAL_HOURS: z.coerce.number().default(1),
  TIMEZONE: z.string().default('Asia/Tashkent'),
  AUTO_POST: z.string().transform((val) => val === 'true').default('true'),
  ADMIN_APPROVAL: z.string().transform((val) => val === 'true').default('false'),

  // Quiet Hours & Peak Hours Settings
  QUIET_HOURS_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  QUIET_HOURS_START: z.coerce.number().default(23), // 23:00 (11 PM)
  QUIET_HOURS_END: z.coerce.number().default(7),    // 07:00 (7 AM)
  PEAK_HOURS_MODE: z.string().transform((val) => val === 'true').default('false'), // 09:00, 13:00, 18:00, 21:00

  DATABASE_URL: z.string().default('file:../data/legal_agent.db'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment configuration error:', parsedEnv.error.format());
}

export const env = parsedEnv.success ? parsedEnv.data : envSchema.parse({});

export const BASE_DIR = path.resolve(__dirname, '../../');
export const LOGS_DIR = path.join(BASE_DIR, 'logs');
export const GENERATED_IMAGES_DIR = path.join(BASE_DIR, 'generated_images');
