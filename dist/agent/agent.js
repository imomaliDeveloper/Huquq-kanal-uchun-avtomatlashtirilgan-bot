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
            // 6. Telegram Text Post with Choice Buttons
            if (shouldPublish) {
                const publishResult = await this.publishTestToTelegram(createdTest);
                if (publishResult.success) {
                    await schema_1.repository.updateTestStatus(createdTest.id, 'published', publishResult.messageId);
                    createdTest.status = 'published';
                    return { success: true, message: `Test #${createdTest.id} kanalga joylandi!`, test: createdTest };
                }
                else {
                    await schema_1.repository.updateTestStatus(createdTest.id, 'error_publish');
                    return { success: false, message: `Test #${createdTest.id} yaratildi, lekin Telegram kanalga yuborib bo'lmadi.`, test: createdTest };
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
    async publishTestToTelegram(test) {
        const { getBot } = await Promise.resolve().then(() => __importStar(require('../bot/bot')));
        const bot = getBot();
        if (!bot || !env_1.env.CHANNEL_ID) {
            logger_1.logger.warn('Bot token or CHANNEL_ID not configured. Skipping live telegram post.');
            return { success: false };
        }
        try {
            const messageText = formatter_1.formatter.formatPostText(test);
            const keyboard = (0, keyboards_1.getChannelQuizKeyboard)(test.id);
            logger_1.logger.info(`Publishing full text quiz with inline choice buttons to channel ${env_1.env.CHANNEL_ID}...`);
            const msg = await bot.api.sendMessage(env_1.env.CHANNEL_ID, messageText, {
                parse_mode: 'HTML',
                reply_markup: keyboard,
            });
            logger_1.logger.info(`Published Text Quiz to channel ${env_1.env.CHANNEL_ID}. MsgID: ${msg.message_id}`);
            return { success: true, messageId: msg.message_id };
        }
        catch (error) {
            logger_1.logger.error(`Error publishing Quiz to Telegram channel: ${error.message}`);
            return { success: false };
        }
    }
}
exports.Agent = Agent;
exports.agent = new Agent();
