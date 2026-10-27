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
  targetChannelId?: string; // specific channel or undefined (all active)
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

    const maxRetries = 5;
    let lastErrorReason = 'Nomaʼlum xatolik';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`Pipeline execution pass ${attempt}/${maxRetries}...`);

      // 1. Topic Selection
      const topic = await topicSelector.selectTopic(options.requestedTopic);

      // 2. Test Generation
      await repository.recordStat('ai_generation');
      const generated = await testGenerator.generate(topic);
      if (!generated || !generated.question || !generated.options || generated.options.length !== 4) {
        lastErrorReason = `AI (${env.AI_PROVIDER}) test strukturasini to‘g‘ri qaytarmadi. API kalitini tekshiring.`;
        logger.warn(`Pass ${attempt}: Failed to generate valid quiz structure.`);
        continue;
      }

      // 3. Fact Checker
      const { isValid, reason } = await factChecker.check(generated);
      if (!isValid) {
        lastErrorReason = `Fact Checker rad etdi: ${reason}`;
        logger.warn(`Pass ${attempt}: Fact checker rejected quiz: ${reason}`);
        continue;
      }

      // 4. Duplicate Checker
      const { isDup, reason: dupReason } = await duplicateChecker.isDuplicate(generated.question);
      if (isDup) {
        lastErrorReason = `Takroriy savol (Duplicate): ${dupReason}`;
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

      // 6. Telegram Channel Post with Choice Buttons
      if (shouldPublish) {
        const publishResult = await this.publishTestToTelegram(createdTest, options.targetChannelId);
        if (publishResult.success) {
          await repository.updateTestStatus(createdTest.id, 'published', publishResult.messageId);
          createdTest.status = 'published';
          return { success: true, message: `Test #${createdTest.id} joylandi! (${publishResult.summary})`, test: createdTest };
        } else {
          await repository.updateTestStatus(createdTest.id, 'error_publish');
          return { success: false, message: `Test #${createdTest.id} yaratildi, lekin kanallarga yuborib bo'lmadi: ${publishResult.summary}`, test: createdTest };
        }
      } else {
        await repository.updateTestStatus(createdTest.id, 'pending_approval');
        createdTest.status = 'pending_approval';
        return { success: true, message: `Test #${createdTest.id} yaratildi (Admin tasdiqlashi kutilmoqda).`, test: createdTest };
      }
    }

    return { success: false, message: `Test yaratishda urinishlar tugadi. Sabab: ${lastErrorReason}` };
  }

  async publishTestToTelegram(
    test: Test,
    targetChannelId?: string
  ): Promise<{ success: boolean; messageId?: number; summary: string }> {
    const { getBot } = await import('../bot/bot');
    const bot = getBot();

    if (!bot) {
      logger.warn('Bot token not configured. Skipping telegram post.');
      return { success: false, summary: 'Bot token mavjud emas' };
    }

    // Determine target channels
    let targets: { channelId: string; title: string }[] = [];

    if (targetChannelId && targetChannelId !== 'all') {
      targets = [{ channelId: targetChannelId, title: targetChannelId }];
    } else {
      const activeChannels = await repository.getActiveChannels();
      if (activeChannels.length > 0) {
        targets = activeChannels.map((c) => ({ channelId: c.channelId, title: c.title || c.channelId }));
      } else if (env.CHANNEL_ID) {
        targets = [{ channelId: env.CHANNEL_ID, title: env.CHANNEL_ID }];
      }
    }

    if (targets.length === 0) {
      logger.warn('No active channels available to post test.');
      return { success: false, summary: 'Hech qanday faol kanal topilmadi. Avval kanal qo‘shing yoki faollashtiring.' };
    }

    const keyboard = getChannelQuizKeyboard(test.id);
    const successfulChannels: string[] = [];
    const failedChannels: string[] = [];
    let firstMessageId: number | undefined;

    for (const target of targets) {
      try {
        let channelTag = target.channelId;

        // Automatically fetch channel's username from Telegram API
        try {
          const chat = await bot.api.getChat(target.channelId);
          if ((chat as any).username) {
            channelTag = `@${(chat as any).username}`;
          } else if ((chat as any).invite_link) {
            channelTag = `<a href="${(chat as any).invite_link}">${(chat as any).title || target.title || 'Kanal'}</a>`;
          } else if (target.channelId.startsWith('@')) {
            channelTag = target.channelId;
          } else if ((chat as any).title) {
            channelTag = `<b>${(chat as any).title}</b>`;
          }
        } catch (chatErr: any) {
          logger.warn(`Could not fetch chat info for '${target.channelId}': ${chatErr?.message || chatErr}`);
          if (!channelTag.startsWith('@') && !channelTag.startsWith('-')) {
            channelTag = `@${channelTag}`;
          }
        }

        const postText = formatter.formatPostText(test, channelTag);
        logger.info(`Publishing text quiz to channel '${target.channelId}' with promo '${channelTag}'...`);

        const channelKeyboard = getChannelQuizKeyboard(test.id, channelTag);
        const msg = await bot.api.sendMessage(target.channelId, postText, {
          parse_mode: 'HTML',
          reply_markup: channelKeyboard,
        });

        successfulChannels.push(channelTag || target.title || target.channelId);
        if (!firstMessageId) firstMessageId = msg.message_id;
      } catch (error: any) {
        logger.error(`Error publishing to channel '${target.channelId}': ${error?.message || error}`);
        failedChannels.push(target.title || target.channelId);
      }
    }

    if (successfulChannels.length > 0) {
      const summary = `Muvaffaqiyatli: ${successfulChannels.join(', ')}` +
        (failedChannels.length > 0 ? ` | Xatolik: ${failedChannels.join(', ')}` : '');
      return { success: true, messageId: firstMessageId, summary };
    } else {
      const summary = `Barcha kanallarda xatolik yuz berdi: ${failedChannels.join(', ')}`;
      return { success: false, summary };
    }
  }
}

export const agent = new Agent();
