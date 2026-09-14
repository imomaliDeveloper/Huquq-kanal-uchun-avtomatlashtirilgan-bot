"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminComposer = void 0;
const grammy_1 = require("grammy");
const agent_1 = require("../agent/agent");
const schema_1 = require("../database/schema");
const formatter_1 = require("../agent/formatter");
const scheduler_1 = require("../scheduler/scheduler");
const keyboards_1 = require("./keyboards");
const env_1 = require("../config/env");
exports.adminComposer = new grammy_1.Composer();
exports.adminComposer.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    // Interactive Quiz Option Answer Callback (ans:testId:optionIdx)
    if (data.startsWith('ans:')) {
        const parts = data.split(':');
        const testId = parseInt(parts[1], 10);
        const chosenIdx = parseInt(parts[2], 10);
        const testItem = await schema_1.repository.getTestById(testId);
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
            alertMsg = (`✅ JAVOBINGIZ TO'G'RI! (${correctLetter})\n\n` +
                `✅ Javob: ${correctOptionContent}\n\n` +
                `📚 Izoh: ${testItem.explanation}\n` +
                `⚖️ Manba: ${testItem.legalSource}`);
        }
        else {
            alertMsg = (`❌ NOTO'G'RI JAVOB! (Siz: ${chosenLetter}, To'g'ri: ${correctLetter})\n\n` +
                `✅ To'g'ri javob: ${correctLetter}) ${correctOptionContent}\n\n` +
                `📚 Izoh: ${testItem.explanation}\n` +
                `⚖️ Manba: ${testItem.legalSource}`);
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
        const result = await agent_1.agent.runPipeline({
            requestedTopic,
            isAuto: false,
            publishImmediately: false,
        });
        if (!result.success || !result.test) {
            await ctx.reply(`❌ <b>Xatolik yuz berdi:</b>\n${result.message}`, { parse_mode: 'HTML' });
            return;
        }
        const testItem = result.test;
        const previewText = formatter_1.formatter.formatPreviewText(testItem);
        const kb = (0, keyboards_1.getPreviewKeyboard)(testItem.id);
        await ctx.reply(previewText, { reply_markup: kb, parse_mode: 'HTML' });
        return;
    }
    // Publish Test Callback
    if (data.startsWith('publish:')) {
        const testId = parseInt(data.split(':')[1], 10);
        const testItem = await schema_1.repository.getTestById(testId);
        if (!testItem) {
            await ctx.answerCallbackQuery({ text: '⚠️ Test topilmadi!', show_alert: true });
            return;
        }
        await ctx.answerCallbackQuery({ text: '🚀 Kanalga yuborilmoqda...' });
        const publishRes = await agent_1.agent.publishTestToTelegram(testItem);
        if (publishRes.success) {
            await schema_1.repository.updateTestStatus(testId, 'published', publishRes.messageId);
            await ctx.reply(`✅ <b>Test #${testId} Telegram kanalga muvaffaqiyatli joylandi!</b>`, { parse_mode: 'HTML' });
        }
        else {
            await ctx.reply(`❌ <b>Test #${testId} kanalga yuborishda xatolik!</b>`, { parse_mode: 'HTML' });
        }
        return;
    }
    // Regenerate Test Callback
    if (data.startsWith('regen:')) {
        const testId = parseInt(data.split(':')[1], 10);
        const testItem = await schema_1.repository.getTestById(testId);
        const topic = testItem?.topic;
        await schema_1.repository.updateTestStatus(testId, 'rejected');
        await ctx.answerCallbackQuery({ text: '🔄 Yangi test yaratilmoqda...' });
        const result = await agent_1.agent.runPipeline({ requestedTopic: topic, isAuto: false, publishImmediately: false });
        if (result.success && result.test) {
            const previewText = formatter_1.formatter.formatPreviewText(result.test);
            const kb = (0, keyboards_1.getPreviewKeyboard)(result.test.id);
            await ctx.reply(previewText, { reply_markup: kb, parse_mode: 'HTML' });
        }
        return;
    }
    // Reject Test Callback
    if (data.startsWith('reject:')) {
        const testId = parseInt(data.split(':')[1], 10);
        await schema_1.repository.updateTestStatus(testId, 'rejected');
        await ctx.answerCallbackQuery({ text: '❌ Test rad etildi.' });
        await ctx.reply(`🗑 <b>Test #${testId} rad etildi.</b>`, { parse_mode: 'HTML' });
        return;
    }
    // Auto Toggle Callback
    if (data.startsWith('auto_toggle:')) {
        const action = data.split(':')[1];
        const isEnabled = action === 'on';
        await scheduler_1.scheduler.setAutoStatus(isEnabled);
        await ctx.answerCallbackQuery({ text: `Avto-posting ${isEnabled ? 'yoqildi' : "o'chirildi"}` });
        await renderAutoPostCard(ctx);
        return;
    }
    // Quiet Hours Toggle Callback
    if (data.startsWith('quiet_toggle:')) {
        const action = data.split(':')[1];
        const isEnabled = action === 'on';
        await scheduler_1.scheduler.setQuietHoursStatus(isEnabled);
        await ctx.answerCallbackQuery({ text: `Tungi jimlik rejimi ${isEnabled ? 'yoqildi (23:00-07:00)' : "o'chirildi"}` });
        await renderAutoPostCard(ctx);
        return;
    }
    // Peak Hours Toggle Callback
    if (data.startsWith('peak_toggle:')) {
        const action = data.split(':')[1];
        const isEnabled = action === 'on';
        await scheduler_1.scheduler.setPeakHoursMode(isEnabled);
        await ctx.answerCallbackQuery({ text: `Peak Rejimi ${isEnabled ? 'yoqildi (09,13,18,21)' : "o'chirildi"}` });
        await renderAutoPostCard(ctx);
        return;
    }
    // Change Interval Menu Callback
    if (data === 'auto_change_interval') {
        await ctx.editMessageText('⏱ <b>Yangi posting intervalini tanlang:</b>', {
            reply_markup: (0, keyboards_1.getIntervalPickerKeyboard)(),
            parse_mode: 'HTML',
        });
        return;
    }
    // Set Interval Callback
    if (data.startsWith('set_int:')) {
        const intervalVal = parseFloat(data.split(':')[1]);
        await scheduler_1.scheduler.setInterval(intervalVal);
        await ctx.answerCallbackQuery({ text: `Interval ${intervalVal} soatga o'zgartirildi.` });
        await renderAutoPostCard(ctx);
        return;
    }
    // History Filter Callback
    if (data.startsWith('hist:')) {
        const filterType = data.split(':')[1];
        const { items, total } = await schema_1.repository.getRecentTests(filterType, undefined, 10, 0);
        if (!items || items.length === 0) {
            await ctx.editMessageText(`📝 <b>Testlar tarixi (${filterType.toUpperCase()}):</b>\n\nUshbu davrda testlar topilmadi.`, {
                reply_markup: (0, keyboards_1.getHistoryFilterKeyboard)(),
                parse_mode: 'HTML',
            });
            return;
        }
        const lines = [`📝 <b>Testlar tarixi (${filterType.toUpperCase()}) - Jami: ${total} ta</b>\n`];
        for (const it of items) {
            const statusIcon = it.status === 'published' ? '✅' : it.status === 'pending_approval' ? '⏳' : '❌';
            lines.push(`${statusIcon} <b>#${it.id}</b> [${it.topic}] - <i>${it.createdAt.toISOString().substring(0, 16)}</i>\n   ❓ ${it.question.substring(0, 50)}...\n`);
        }
        await ctx.editMessageText(lines.join('\n'), { reply_markup: (0, keyboards_1.getHistoryFilterKeyboard)(), parse_mode: 'HTML' });
        return;
    }
    if (data === 'admin_menu' || data === 'menu:auto') {
        await renderAutoPostCard(ctx);
        return;
    }
});
async function renderAutoPostCard(ctx) {
    const autoOnStr = await schema_1.repository.getSetting('auto_post_enabled', String(env_1.env.AUTO_POST));
    const quietOnStr = await schema_1.repository.getSetting('quiet_hours_enabled', String(env_1.env.QUIET_HOURS_ENABLED));
    const peakOnStr = await schema_1.repository.getSetting('peak_hours_mode', String(env_1.env.PEAK_HOURS_MODE));
    const interval = await schema_1.repository.getSetting('post_interval_hours', String(env_1.env.POST_INTERVAL_HOURS));
    const isAuto = autoOnStr.toLowerCase() === 'true';
    const isQuiet = quietOnStr.toLowerCase() === 'true';
    const isPeak = peakOnStr.toLowerCase() === 'true';
    const text = (`🤖 <b>Avtomatik posting boshqaruvi</b>\n\n` +
        `<b>Status:</b> ${isAuto ? '🟢 Yoqilgan' : '🔴 O‘chirilgan'}\n` +
        `<b>Rejim:</b> ${isPeak ? '⭐ Peak Hours (09:00, 13:00, 18:00, 21:00)' : `⏱ Har ${interval} soatda`}\n` +
        `<b>🌙 Tungi Jimlik (Quiet Hours):</b> ${isQuiet ? '🟢 Yoqilgan (23:00 - 07:00)' : '🔴 O‘chirilgan'}`);
    const kb = (0, keyboards_1.getAutoPostKeyboard)(isAuto, isQuiet, isPeak);
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
}
