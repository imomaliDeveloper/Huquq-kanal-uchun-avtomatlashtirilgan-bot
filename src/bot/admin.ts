import { Composer } from 'grammy';
import { agent } from '../agent/agent';
import { repository } from '../database/schema';
import { formatter } from '../agent/formatter';
import { scheduler } from '../scheduler/scheduler';
import {
  getPreviewKeyboard,
  getPublishTargetKeyboard,
  getChannelsManagementKeyboard,
  getAutoPostKeyboard,
  getIntervalPickerKeyboard,
  getHistoryFilterKeyboard,
} from './keyboards';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const adminComposer = new Composer();

// In-memory admin interaction state
export const adminState: Record<number, { step: string; [key: string]: any }> = {};

export async function renderChannelsCard(ctx: any) {
  const channels = await repository.getAllChannels();
  const activeCount = channels.filter((c) => c.isActive).length;

  let channelListText = '';
  if (channels.length === 0) {
    channelListText = '<i>Hozircha hech qanday kanal ulanmagan.</i>\n';
  } else {
    channelListText =
      channels
        .map((c, i) => {
          const status = c.isActive ? '🟢 Faol' : '⏸️ Pauzada';
          return `${i + 1}. <b>${c.title || c.channelId}</b> (<code>${c.channelId}</code>) — ${status}`;
        })
        .join('\n') + '\n';
  }

  const text = (
    `📢 <b>ULANGAN KANALLAR BOSHQARUVI</b>\n\n` +
    channelListText +
    `\n📊 <b>Faol kanallar:</b> ${activeCount} ta\n` +
    `📚 <b>Jami kanallar:</b> ${channels.length} ta\n\n` +
    `<i>Har bir kanal yonidagi tugmani bosib uni pauzaga qo'yishingiz yoki qayta yoqishingiz mumkin.</i>`
  );

  const kb = getChannelsManagementKeyboard(channels);
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
  } else {
    await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
  }
}

adminComposer.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;

  // Interactive Quiz Option Answer Callback (ans:testId:optionIdx)
  if (data.startsWith('ans:')) {
    const parts = data.split(':');
    const testId = parseInt(parts[1], 10);
    const chosenIdx = parseInt(parts[2], 10);

    const testItem = await repository.getTestById(testId);
    if (!testItem) {
      await ctx.answerCallbackQuery({ text: '⚠️ Test topilmadi.', show_alert: true });
      return;
    }

    const isCorrect = chosenIdx === testItem.correctAnswer;
    const letters = ['A', 'B', 'C', 'D'];
    const optionsText = [testItem.optionA, testItem.optionB, testItem.optionC, testItem.optionD];

    const correctLetter = letters[testItem.correctAnswer] || 'A';
    const correctOptionContent = optionsText[testItem.correctAnswer] || '';
    const chosenLetter = letters[chosenIdx] || 'A';

    let alertMsg = '';
    if (isCorrect) {
      alertMsg = (
        `✅ JAVOBINGIZ TO'G'RI! (${correctLetter})\n\n` +
        `✅ Javob: ${correctOptionContent}\n\n` +
        `📚 Izoh: ${testItem.explanation}\n` +
        `⚖️ Manba: ${testItem.legalSource}`
      );
    } else {
      alertMsg = (
        `❌ NOTO'G'RI JAVOB! (Siz: ${chosenLetter}, To'g'ri: ${correctLetter})\n\n` +
        `✅ To'g'ri javob: ${correctLetter}) ${correctOptionContent}\n\n` +
        `📚 Izoh: ${testItem.explanation}\n` +
        `⚖️ Manba: ${testItem.legalSource}`
      );
    }

    // Telegram pop-up dialog limit is 200 chars
    if (alertMsg.length > 200) {
      alertMsg = alertMsg.substring(0, 195) + '...';
    }

    await ctx.answerCallbackQuery({
      text: alertMsg,
      show_alert: true,
    });
    return;
  }

  // Topic Selection Callback
  if (data.startsWith('topic:')) {
    const topicKey = data.split(':', 2)[1];
    const requestedTopic = topicKey === 'random' ? undefined : topicKey;

    await ctx.answerCallbackQuery({ text: '🤖 AI Test tayyorlanmoqda...' });
    await ctx.editMessageText('⏳ <b>AI Agent ishlamoqda:</b>\n1. Mavzu tahlil qilinmoqda\n2. Qonuniy manba tekshirilmoqda\n3. Test yaratilmoqda va tekshirilmoqda...', { parse_mode: 'HTML' });

    const result = await agent.runPipeline({
      requestedTopic,
      isAuto: false,
      publishImmediately: false,
    });

    if (!result.success || !result.test) {
      await ctx.reply(`❌ <b>Xatolik yuz berdi:</b>\n${result.message}`, { parse_mode: 'HTML' });
      return;
    }

    const testItem = result.test;
    const previewText = formatter.formatPreviewText(testItem);
    const kb = getPreviewKeyboard(testItem.id);

    await ctx.reply(previewText, { reply_markup: kb, parse_mode: 'HTML' });
    return;
  }

  // Publish Test Callback (with channel selection if multiple active channels)
  if (data.startsWith('publish:')) {
    const testId = parseInt(data.split(':')[1], 10);
    const testItem = await repository.getTestById(testId);

    if (!testItem) {
      await ctx.answerCallbackQuery({ text: '⚠️ Test topilmadi!', show_alert: true });
      return;
    }

    const activeChannels = await repository.getActiveChannels();

    if (activeChannels.length > 1) {
      // Multiple active channels available: let admin choose
      await ctx.answerCallbackQuery();
      const kb = getPublishTargetKeyboard(testId, activeChannels);
      await ctx.reply(
        `📢 <b>Qaysi kanal(lar)ga joylashtirmoqchisiz?</b>\n\n` +
        `Faol kanallar: <b>${activeChannels.length} ta</b>\n` +
        `Quyidagi variantlardan birini tanlang:`,
        { reply_markup: kb, parse_mode: 'HTML' }
      );
      return;
    }

    // Single active channel or default
    await ctx.answerCallbackQuery({ text: '🚀 Kanalga yuborilmoqda...' });
    const publishRes = await agent.publishTestToTelegram(testItem);

    if (publishRes.success) {
      await repository.updateTestStatus(testId, 'published', publishRes.messageId);
      await ctx.reply(`✅ <b>Test #${testId} Telegram kanalga joylandi!</b>\n\n${publishRes.summary}`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ <b>Test #${testId} kanalga yuborishda xatolik:</b>\n${publishRes.summary}`, { parse_mode: 'HTML' });
    }
    return;
  }

  // Publish To Specific Channel / All Channels (pub_to:testId:target)
  if (data.startsWith('pub_to:')) {
    const parts = data.split(':');
    const testId = parseInt(parts[1], 10);
    const target = parts[2];

    const testItem = await repository.getTestById(testId);
    if (!testItem) {
      await ctx.answerCallbackQuery({ text: '⚠️ Test topilmadi!', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: '🚀 Kanalga yuborilmoqda...' });

    let targetChannelId: string | undefined = undefined;
    if (target !== 'all') {
      const ch = await repository.getChannelById(parseInt(target, 10));
      targetChannelId = ch?.channelId;
    }

    const publishRes = await agent.publishTestToTelegram(testItem, targetChannelId);

    if (publishRes.success) {
      await repository.updateTestStatus(testId, 'published', publishRes.messageId);
      await ctx.editMessageText(`✅ <b>Test #${testId} muvaffaqiyatli joylandi!</b>\n\n${publishRes.summary}`, { parse_mode: 'HTML' });
    } else {
      await ctx.editMessageText(`❌ <b>Test #${testId} joylashda xatolik:</b>\n${publishRes.summary}`, { parse_mode: 'HTML' });
    }
    return;
  }

  // Regenerate Test Callback
  if (data.startsWith('regen:')) {
    const testId = parseInt(data.split(':')[1], 10);
    const testItem = await repository.getTestById(testId);
    const topic = testItem?.topic;

    await repository.updateTestStatus(testId, 'rejected');
    await ctx.answerCallbackQuery({ text: '🔄 Yangi test yaratilmoqda...' });

    const result = await agent.runPipeline({ requestedTopic: topic, isAuto: false, publishImmediately: false });
    if (result.success && result.test) {
      const previewText = formatter.formatPreviewText(result.test);
      const kb = getPreviewKeyboard(result.test.id);
      await ctx.reply(previewText, { reply_markup: kb, parse_mode: 'HTML' });
    }
    return;
  }

  // Reject Test Callback
  if (data.startsWith('reject:')) {
    const testId = parseInt(data.split(':')[1], 10);
    await repository.updateTestStatus(testId, 'rejected');
    await ctx.answerCallbackQuery({ text: '❌ Test rad etildi.' });
    await ctx.reply(`🗑 <b>Test #${testId} rad etildi.</b>`, { parse_mode: 'HTML' });
    return;
  }

  // --- Channel Management Callbacks ---
  if (data.startsWith('ch_toggle:')) {
    const channelId = parseInt(data.split(':')[1], 10);
    const updated = await repository.toggleChannelActive(channelId);
    if (updated) {
      const statusText = updated.isActive ? '🟢 Kanal faollashtirildi!' : '⏸️ Kanal pauzaga qo\'yildi!';
      await ctx.answerCallbackQuery({ text: statusText });
    } else {
      await ctx.answerCallbackQuery({ text: '⚠️ Kanal topilmadi!' });
    }
    await renderChannelsCard(ctx);
    return;
  }

  if (data.startsWith('ch_del:')) {
    const channelId = parseInt(data.split(':')[1], 10);
    try {
      await repository.deleteChannel(channelId);
      await ctx.answerCallbackQuery({ text: '🗑️ Kanal o‘chirildi!' });
    } catch {
      await ctx.answerCallbackQuery({ text: '⚠️ O‘chirishda xatolik!' });
    }
    await renderChannelsCard(ctx);
    return;
  }

  if (data === 'ch_refresh') {
    await ctx.answerCallbackQuery({ text: '🔄 Yangilandi' });
    await renderChannelsCard(ctx);
    return;
  }

  if (data === 'ch_add') {
    if (ctx.from?.id) {
      adminState[ctx.from.id] = { step: 'awaiting_channel_id' };
    }
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📢 <b>Yangi kanal qo‘shish:</b>\n\n` +
      `Iltimos, kanal username'ini (@ belgi bilan, masalan: <code>@Huquq_study</code>) yoki kanal ID-sini (masalan: <code>-1001234567890</code>) yozib yuboring:\n\n` +
      `⚠️ <i>Eslatma: Kanalni yuborishdan oldin botni ushbu kanalga ADMINISTRATOR qilib qo‘shganingizga va xabarlar joylash (Post Messages) huquqini berganingizga ishonch hosil qiling!</i>`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Auto Toggle Callback
  if (data.startsWith('auto_toggle:')) {
    const action = data.split(':')[1];
    const isEnabled = action === 'on';
    await scheduler.setAutoStatus(isEnabled);
    await ctx.answerCallbackQuery({ text: `Avto-posting ${isEnabled ? 'yoqildi' : "o'chirildi"}` });
    await renderAutoPostCard(ctx);
    return;
  }

  // Quiet Hours Toggle Callback
  if (data.startsWith('quiet_toggle:')) {
    const action = data.split(':')[1];
    const isEnabled = action === 'on';
    await scheduler.setQuietHoursStatus(isEnabled);
    await ctx.answerCallbackQuery({ text: `Tungi jimlik rejimi ${isEnabled ? 'yoqildi (23:00-07:00)' : "o'chirildi"}` });
    await renderAutoPostCard(ctx);
    return;
  }

  // Peak Hours Toggle Callback
  if (data.startsWith('peak_toggle:')) {
    const action = data.split(':')[1];
    const isEnabled = action === 'on';
    await scheduler.setPeakHoursMode(isEnabled);
    await ctx.answerCallbackQuery({ text: `Peak Rejimi ${isEnabled ? 'yoqildi (09,13,18,21)' : "o'chirildi"}` });
    await renderAutoPostCard(ctx);
    return;
  }

  // Change Interval Menu Callback
  if (data === 'auto_change_interval') {
    await ctx.editMessageText('⏱ <b>Yangi posting intervalini tanlang:</b>', {
      reply_markup: getIntervalPickerKeyboard(),
      parse_mode: 'HTML',
    });
    return;
  }

  // Set Interval Callback
  if (data.startsWith('set_int:')) {
    const intervalVal = parseFloat(data.split(':')[1]);
    await scheduler.setInterval(intervalVal);
    await ctx.answerCallbackQuery({ text: `Interval ${intervalVal} soatga o'zgartirildi.` });
    await renderAutoPostCard(ctx);
    return;
  }

  // History Filter Callback
  if (data.startsWith('hist:')) {
    const filterType = data.split(':')[1];
    const { items, total } = await repository.getRecentTests(filterType, undefined, 10, 0);

    if (!items || items.length === 0) {
      await ctx.editMessageText(`📝 <b>Testlar tarixi (${filterType.toUpperCase()}):</b>\n\nUshbu davrda testlar topilmadi.`, {
        reply_markup: getHistoryFilterKeyboard(),
        parse_mode: 'HTML',
      });
      return;
    }

    const lines = [`📝 <b>Testlar tarixi (${filterType.toUpperCase()}) - Jami: ${total} ta</b>\n`];
    for (const it of items) {
      const statusIcon = it.status === 'published' ? '✅' : it.status === 'pending_approval' ? '⏳' : '❌';
      lines.push(`${statusIcon} <b>#${it.id}</b> [${it.topic}] - <i>${it.createdAt.toISOString().substring(0, 16)}</i>\n   ❓ ${it.question.substring(0, 50)}...\n`);
    }

    await ctx.editMessageText(lines.join('\n'), { reply_markup: getHistoryFilterKeyboard(), parse_mode: 'HTML' });
    return;
  }

  if (data === 'admin_menu' || data === 'menu:auto') {
    await renderAutoPostCard(ctx);
    return;
  }

  if (data === 'action:cancel') {
    await ctx.deleteMessage();
    return;
  }
});

async function renderAutoPostCard(ctx: any) {
  const autoOnStr = await repository.getSetting('auto_post_enabled', String(env.AUTO_POST));
  const quietOnStr = await repository.getSetting('quiet_hours_enabled', String(env.QUIET_HOURS_ENABLED));
  const peakOnStr = await repository.getSetting('peak_hours_mode', String(env.PEAK_HOURS_MODE));
  const interval = await repository.getSetting('post_interval_hours', String(env.POST_INTERVAL_HOURS));

  const isAuto = autoOnStr.toLowerCase() === 'true';
  const isQuiet = quietOnStr.toLowerCase() === 'true';
  const isPeak = peakOnStr.toLowerCase() === 'true';

  const text = (
    `🤖 <b>Avtomatik posting boshqaruvi</b>\n\n` +
    `<b>Status:</b> ${isAuto ? '🟢 Yoqilgan' : '🔴 O‘chirilgan'}\n` +
    `<b>Rejim:</b> ${isPeak ? '⭐ Peak Hours (09:00, 13:00, 18:00, 21:00)' : `⏱ Har ${interval} soatda`}\n` +
    `<b>🌙 Tungi Jimlik (Quiet Hours):</b> ${isQuiet ? '🟢 Yoqilgan (23:00 - 07:00)' : '🔴 O‘chirilgan'}`
  );

  const kb = getAutoPostKeyboard(isAuto, isQuiet, isPeak);
  await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
}
