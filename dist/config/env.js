"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERATED_IMAGES_DIR = exports.LOGS_DIR = exports.BASE_DIR = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
dotenv_1.default.config();
const normalizeChannelId = (val) => {
    if (!val)
        return '';
    let cleaned = val.trim();
    if (cleaned.startsWith('https://t.me/')) {
        cleaned = '@' + cleaned.replace('https://t.me/', '');
    }
    else if (cleaned.startsWith('t.me/')) {
        cleaned = '@' + cleaned.replace('t.me/', '');
    }
    else if (!cleaned.startsWith('@') && !cleaned.startsWith('-')) {
        cleaned = '@' + cleaned;
    }
    return cleaned;
};
// Ensure DATABASE_URL is always a valid file: protocol URL for SQLite
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
    process.env.DATABASE_URL = 'file:../data/legal_agent.db';
}
const envSchema = zod_1.z.object({
    BOT_TOKEN: zod_1.z.string().default(''),
    CHANNEL_ID: zod_1.z.string().transform(normalizeChannelId).default(''),
    ADMIN_ID: zod_1.z.coerce.number().default(0),
    AI_PROVIDER: zod_1.z.string().default('gemini'),
    AI_API_KEY: zod_1.z.string().default(''),
    GEMINI_API_KEY: zod_1.z.string().default(''),
    AI_MODEL: zod_1.z.string().default('gemini-3.6-flash'),
    IMAGE_PROVIDER: zod_1.z.string().default('pollinations'),
    IMAGE_API_KEY: zod_1.z.string().default(''),
    POST_INTERVAL_HOURS: zod_1.z.coerce.number().default(1),
    TIMEZONE: zod_1.z.string().default('Asia/Tashkent'),
    AUTO_POST: zod_1.z.string().transform((val) => val === 'true').default('true'),
    ADMIN_APPROVAL: zod_1.z.string().transform((val) => val === 'true').default('false'),
    // Quiet Hours & Peak Hours Settings
    QUIET_HOURS_ENABLED: zod_1.z.string().transform((val) => val === 'true').default('true'),
    QUIET_HOURS_START: zod_1.z.coerce.number().default(23), // 23:00 (11 PM)
    QUIET_HOURS_END: zod_1.z.coerce.number().default(7), // 07:00 (7 AM)
    PEAK_HOURS_MODE: zod_1.z.string().transform((val) => val === 'true').default('false'), // 09:00, 13:00, 18:00, 21:00
    DATABASE_URL: zod_1.z.string().default('file:../data/legal_agent.db'),
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error('❌ Environment configuration error:', parsedEnv.error.format());
}
exports.env = parsedEnv.success ? parsedEnv.data : envSchema.parse({});
exports.BASE_DIR = path_1.default.resolve(__dirname, '../../');
exports.LOGS_DIR = path_1.default.join(exports.BASE_DIR, 'logs');
exports.GENERATED_IMAGES_DIR = path_1.default.join(exports.BASE_DIR, 'generated_images');
