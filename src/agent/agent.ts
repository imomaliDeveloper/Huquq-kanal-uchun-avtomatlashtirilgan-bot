import { topicSelector } from './topicSelector';
import { testGenerator } from './testGenerator';
import { factChecker } from './factChecker';
import { duplicateChecker, computeHash } from './duplicateChecker';
import { repository } from '../database/schema';
import { formatter } from './formatter';
import { getChannelQuizKeyboard } from '../bot/keyboards';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { Test } from '@prisma/client';

export interface RunAgentOptions {
  requestedTopic?: string;
  isAuto?: boolean;
  publishImmediately?: boolean;
}

export class Agent {
  async runPipeline(options: RunAgentOptions = {}): Promise<{ success: boolean; message: string; test?: Test }> {
    logger.info('==================================================');
    logger.info('STARTING TS AI AUTONOMOUS CONTENT AGENT PIPELINE');
    logger.info('==================================================');

    const adminApprovalVal = await repository.getSetting('admin_approval', String(env.ADMIN_APPROVAL));
    const requireApproval = adminApprovalVal === 'true';

    const shouldPublish = options.publishImmediately !== undefined
      ? options.publishImmediately
      : !requireApproval;

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`Pipeline execution pass ${attempt}/${maxRetries}...`);

      // 1. Topic Selection
      const topic = await topicSelector.selectTopic(options.requestedTopic);

      // 2. Test Generation
      await repository.recordStat('ai_generation');
      const generated = await testGenerator.generate(topic);
      if (!generated || !generated.question || !generated.options || generated.options.length !== 4) {
        logger.warn(`Pass ${attempt}: Failed to generate valid quiz structure.`);
        continue;
      }

      // 3. Fact Checker
      const { isValid, reason } = await factChecker.check(generated);
      if (!isValid) {
        logger.warn(`Pass ${attempt}: Fact checker rejected quiz: ${reason}`);
        continue;
      }

      // 4. Duplicate Checker
      const { isDup, reason: dupReason } = await duplicateChecker.isDuplicate(generated.question);
      if (isDup) {
        logger.warn(`Pass ${attempt}: Duplicate detected (${dupReason}). Retrying with new quiz...`);
        continue;
      }

      // 5. Database Save
      const questionHash = computeHash(generated.question);
      const createdTest = await repository.createTest({
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

      logger.info(`Test created in database with ID #${createdTest.id}`);

      // 6. Telegram Text Post with Choice Buttons
      if (shouldPublish) {
        const publishResult = await this.publishTestToTelegram(createdTest);
        if (publishResult.success) {
          await repository.updateTestStatus(createdTest.id, 'published', publishResult.messageId);
          createdTest.status = 'published';
          return { success: true, message: `Test #${createdTest.id} kanalga joylandi!`, test: createdTest };
        } else {
          await repository.updateTestStatus(createdTest.id, 'error_publish');
          return { success: false, message: `Test #${createdTest.id} yaratildi, lekin Telegram kanalga yuborib bo'lmadi.`, test: createdTest };
        }
      } else {
        await repository.updateTestStatus(createdTest.id, 'pending_approval');
        createdTest.status = 'pending_approval';
        return { success: true, message: `Test #${createdTest.id} yaratildi (Admin tasdiqlashi kutilmoqda).`, test: createdTest };
      }
    }

    return { success: false, message: 'Test yaratishda max urinishlar tugadi.' };
  }

  async publishTestToTelegram(test: Test): Promise<{ success: boolean; messageId?: number }> {
    const { getBot } = await import('../bot/bot');
    const bot = getBot();

    if (!bot || !env.CHANNEL_ID) {
      logger.warn('Bot token or CHANNEL_ID not configured. Skipping live telegram post.');
      return { success: false };
    }

    try {
      const messageText = formatter.formatPostText(test);
      const keyboard = getChannelQuizKeyboard(test.id);

      logger.info(`Publishing full text quiz with inline choice buttons to channel ${env.CHANNEL_ID}...`);

      const msg = await bot.api.sendMessage(env.CHANNEL_ID, messageText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });

      logger.info(`Published Text Quiz to channel ${env.CHANNEL_ID}. MsgID: ${msg.message_id}`);
      return { success: true, messageId: msg.message_id };
    } catch (error) {
      logger.error(`Error publishing Quiz to Telegram channel: ${(error as Error).message}`);
      return { success: false };
    }
  }
}

export const agent = new Agent();
