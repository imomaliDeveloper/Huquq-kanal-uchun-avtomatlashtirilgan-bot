"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.agent = exports.Agent = void 0;
const topicSelector_1 = require("./topicSelector");
const testGenerator_1 = require("./testGenerator");
const factChecker_1 = require("./factChecker");
const duplicateChecker_1 = require("./duplicateChecker");
const schema_1 = require("../database/schema");
const formatter_1 = require("./formatter");
const keyboards_1 = require("../bot/keyboards");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
class Agent {
    async runPipeline(options = {}) {
        logger_1.logger.info('==================================================');
        logger_1.logger.info('STARTING TS AI AUTONOMOUS CONTENT AGENT PIPELINE');
        logger_1.logger.info('==================================================');
        const adminApprovalVal = await schema_1.repository.getSetting('admin_approval', String(env_1.env.ADMIN_APPROVAL));
        const requireApproval = adminApprovalVal === 'true';
        const shouldPublish = options.publishImmediately !== undefined
            ? options.publishImmediately
            : !requireApproval;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            logger_1.logger.info(`Pipeline execution pass ${attempt}/${maxRetries}...`);
            // 1. Topic Selection
            const topic = await topicSelector_1.topicSelector.selectTopic(options.requestedTopic);
            // 2. Test Generation
            await schema_1.repository.recordStat('ai_generation');
            const generated = await testGenerator_1.testGenerator.generate(topic);
            if (!generated || !generated.question || !generated.options || generated.options.length !== 4) {
                logger_1.logger.warn(`Pass ${attempt}: Failed to generate valid quiz structure.`);
                continue;
            }
            // 3. Fact Checker
            const { isValid, reason } = await factChecker_1.factChecker.check(generated);
            if (!isValid) {
                logger_1.logger.warn(`Pass ${attempt}: Fact checker rejected quiz: ${reason}`);
                continue;
            }
            // 4. Duplicate Checker
            const { isDup, reason: dupReason } = await duplicateChecker_1.duplicateChecker.isDuplicate(generated.question);
            if (isDup) {
                logger_1.logger.warn(`Pass ${attempt}: Duplicate detected (${dupReason}). Retrying with new quiz...`);
                continue;
            }
            // 5. Database Save
            const questionHash = (0, duplicateChecker_1.computeHash)(generated.question);
            const createdTest = await schema_1.repository.createTest({
                topic,
                question: generated.question,
                questionHash,
                optionA: generated.options[0],
                optionB: generated.options[1],
                optionC: generated.options[2],
                optionD: generated.options[3],
                correctAnswer: generated.correct_answer ?? 0,
                explanation: generated.explanation || '',
                legalSource: generated.legal_source || `O'zbekiston Respublikasi ${topic}`,
                sourceUrl: generated.source_url || 'https://lex.uz',
                isAuto: options.isAuto ?? true,
                status: shouldPublish ? 'published' : 'draft',
            });
            logger_1.logger.info(`Test created in database with ID #${createdTest.id}`);
            // 6. Telegram Channel Post with Choice Buttons
            if (shouldPublish) {
                const publishResult = await this.publishTestToTelegram(createdTest, options.targetChannelId);
                if (publishResult.success) {
                    await schema_1.repository.updateTestStatus(createdTest.id, 'published', publishResult.messageId);
                    createdTest.status = 'published';
                    return { success: true, message: `Test #${createdTest.id} joylandi! (${publishResult.summary})`, test: createdTest };
                }
                else {
                    await schema_1.repository.updateTestStatus(createdTest.id, 'error_publish');
                    return { success: false, message: `Test #${createdTest.id} yaratildi, lekin kanallarga yuborib bo'lmadi: ${publishResult.summary}`, test: createdTest };
                }
            }
            else {
                await schema_1.repository.updateTestStatus(createdTest.id, 'pending_approval');
                createdTest.status = 'pending_approval';
                return { success: true, message: `Test #${createdTest.id} yaratildi (Admin tasdiqlashi kutilmoqda).`, test: createdTest };
            }
        }
        return { success: false, message: 'Test yaratishda max urinishlar tugadi.' };
    }
    async publishTestToTelegram(test, targetChannelId) {
        const { getBot } = await Promise.resolve().then(() => __importStar(require('../bot/bot')));
        const bot = getBot();
        if (!bot) {
            logger_1.logger.warn('Bot token not configured. Skipping telegram post.');
            return { success: false, summary: 'Bot token mavjud emas' };
        }
        // Determine target channels
        let targets = [];
        if (targetChannelId && targetChannelId !== 'all') {
            targets = [{ channelId: targetChannelId, title: targetChannelId }];
        }
        else {
            const activeChannels = await schema_1.repository.getActiveChannels();
            if (activeChannels.length > 0) {
                targets = activeChannels.map((c) => ({ channelId: c.channelId, title: c.title || c.channelId }));
            }
            else if (env_1.env.CHANNEL_ID) {
                targets = [{ channelId: env_1.env.CHANNEL_ID, title: env_1.env.CHANNEL_ID }];
            }
        }
        if (targets.length === 0) {
            logger_1.logger.warn('No active channels available to post test.');
            return { success: false, summary: 'Hech qanday faol kanal topilmadi. Avval kanal qo‘shing yoki faollashtiring.' };
        }
        const keyboard = (0, keyboards_1.getChannelQuizKeyboard)(test.id);
        const successfulChannels = [];
        const failedChannels = [];
        let firstMessageId;
        // Dynamically retrieve the bot's username
        let botTag = '@Huquqchi_bot';
        try {
            const me = bot.botInfo || (await bot.api.getMe());
            if (me?.username) {
                botTag = `@${me.username}`;
            }
        }
        catch {
            // Keep default fallback
        }
        for (const target of targets) {
            try {
                let channelTag = target.channelId;
                // Automatically fetch channel's username from Telegram API
                try {
                    const chat = await bot.api.getChat(target.channelId);
                    if (chat.username) {
                        channelTag = `@${chat.username}`;
                    }
                    else if (chat.invite_link) {
                        channelTag = `<a href="${chat.invite_link}">${chat.title || target.title || 'Kanal'}</a>`;
                    }
                    else if (target.channelId.startsWith('@')) {
                        channelTag = target.channelId;
                    }
                    else if (chat.title) {
                        channelTag = `<b>${chat.title}</b>`;
                    }
                }
                catch (chatErr) {
                    logger_1.logger.warn(`Could not fetch chat info for '${target.channelId}': ${chatErr?.message || chatErr}`);
                    if (!channelTag.startsWith('@') && !channelTag.startsWith('-')) {
                        channelTag = `@${channelTag}`;
                    }
                }
                const postText = formatter_1.formatter.formatPostText(test, channelTag, botTag);
                logger_1.logger.info(`Publishing text quiz to channel '${target.channelId}' with promo '${channelTag}'...`);
                const msg = await bot.api.sendMessage(target.channelId, postText, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                });
                successfulChannels.push(channelTag || target.title || target.channelId);
                if (!firstMessageId)
                    firstMessageId = msg.message_id;
            }
            catch (error) {
                logger_1.logger.error(`Error publishing to channel '${target.channelId}': ${error?.message || error}`);
                failedChannels.push(target.title || target.channelId);
            }
        }
        if (successfulChannels.length > 0) {
            const summary = `Muvaffaqiyatli: ${successfulChannels.join(', ')}` +
                (failedChannels.length > 0 ? ` | Xatolik: ${failedChannels.join(', ')}` : '');
            return { success: true, messageId: firstMessageId, summary };
        }
        else {
            const summary = `Barcha kanallarda xatolik yuz berdi: ${failedChannels.join(', ')}`;
            return { success: false, summary };
        }
    }
}
exports.Agent = Agent;
exports.agent = new Agent();
