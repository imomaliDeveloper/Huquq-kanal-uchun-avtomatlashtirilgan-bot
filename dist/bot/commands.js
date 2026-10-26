"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commandsComposer = void 0;
const grammy_1 = require("grammy");
const agent_1 = require("../agent/agent");
const schema_1 = require("../database/schema");
const scheduler_1 = require("../scheduler/scheduler");
const keyboards_1 = require("./keyboards");
const admin_1 = require("./admin");
const topicSelector_1 = require("../agent/topicSelector");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
exports.commandsComposer = new grammy_1.Composer();
// Check Admin Authorization Middleware
exports.commandsComposer.use(async (ctx, next) => {
    // PUBLIC BYPASS: Allow ALL channel subscribers to click interactive quiz answer buttons (ans:...)
    if (ctx.callbackQuery?.data?.startsWith('ans:')) {
        return await next();
    }
    // RESTRICT ADMIN COMMANDS & CONTROL PANEL ONLY TO ADMIN_ID
    if (env_1.env.ADMIN_ID && ctx.from?.id && ctx.from.id !== env_1.env.ADMIN_ID) {
        logger_1.logger.warn(`Unauthorized access attempt to admin feature by user ${ctx.from.id}`);
        if (ctx.callbackQuery) {
            await ctx.answerCallbackQuery({ text: '⚠️ Kechirasiz, bu bot paneli faqat Administrator uchun!', show_alert: true });
        }
        else {
            await ctx.reply('⚠️ Kechirasiz, bu bot boshqaruvi faqat Administrator uchun ajratilgan.');
        }
        return;
    }
    await next();
});
// Admin interactive state interceptor (e.g. adding channel)
exports.commandsComposer.on('message:text', async (ctx, next) => {
    const userId = ctx.from?.id;
    const text = ctx.message.text.trim();
    if (userId && admin_1.adminState[userId]?.step === 'awaiting_channel_id') {
        if (text === '/cancel' || text.toLowerCase() === 'bekor qilish') {
            delete admin_1.adminState[userId];
            await ctx.reply('❌ Kanal qo‘shish bekor qilindi.', { reply_markup: (0, keyboards_1.getMainAdminKeyboard)() });
            return;
        }
        let cleanId = text;
        if (cleanId.startsWith('https://t.me/'))
            cleanId = '@' + cleanId.replace('https://t.me/', '');
        if (cleanId.startsWith('t.me/'))
            cleanId = '@' + cleanId.replace('t.me/', '');
        if (!cleanId.startsWith('@') && !cleanId.startsWith('-'))
            cleanId = '@' + cleanId;
        await ctx.reply('⏳ Kanal tekshirilmoqda, iltimos kuting...');
        try {
            const chat = await ctx.api.getChat(cleanId);
            const title = chat.title || cleanId;
            if (chat.username) {
                cleanId = '@' + chat.username;
            }
            await schema_1.repository.addChannel(cleanId, title);
            delete admin_1.adminState[userId];
            await ctx.reply(`✅ <b>Kanal muvaffaqiyatli qo‘shildi va faollashtirildi!</b>\n\n` +
                `📌 <b>Nomi:</b> ${title}\n` +
                `🆔 <b>Manzili:</b> <code>${cleanId}</code>\n\n` +
                `Endi ushbu kanalga ham yangi testlar avtomatik va qo'lda joylanadi.`, { reply_markup: (0, keyboards_1.getMainAdminKeyboard)(), parse_mode: 'HTML' });
            await (0, admin_1.renderChannelsCard)(ctx);
            return;
        }
        catch (err) {
            await ctx.reply(`❌ <b>Kanalga ulanib bo‘lmadi!</b>\n\n` +
                `<i>Xatolik:</i> ${err?.message || err}\n\n` +
                `⚠️ <b>Quyidagilarni tekshiring:</b>\n` +
                `1. Botni ushbu kanalga <b>Administrator</b> qilib qo‘shganingizga ishonch hosil qiling.\n` +
                `2. Botga <b>Xabarlar joylash (Post Messages)</b> ruxsati berilgan bo‘lishi shart.\n` +
                `3. Kanal username yoki ID-si to‘g‘ri yozilganini tekshiring.\n\n` +
                `Qaytadan yuboring yoki bekor qilish uchun /cancel deb yozing:`, { parse_mode: 'HTML' });
            return;
        }
    }
    // Intercept Custom Interval input (e.g. "1", "5", "10")
    if (userId && admin_1.adminState[userId]?.step === 'awaiting_custom_interval') {
        if (text === '/cancel' || text.toLowerCase() === 'bekor qilish') {
            delete admin_1.adminState[userId];
            await ctx.reply('❌ Interval kiritish bekor qilindi.', { reply_markup: (0, keyboards_1.getMainAdminKeyboard)() });
            return;
        }
        const minutes = parseInt(text, 10);
        if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
            await ctx.reply('⚠️ <b>Noto‘g‘ri format!</b>\n\n' +
                'Iltimos, 1 dan 1440 gacha bo‘lgan musbat butun son kiriting (masalan: <code>1</code>, <code>5</code>, <code>10</code>):\n\n' +
                'Bekor qilish uchun: /cancel', { parse_mode: 'HTML' });
            return;
        }
        delete admin_1.adminState[userId];
        await scheduler_1.scheduler.setIntervalMinutes(minutes);
        const desc = minutes < 60 ? `${minutes} daqiqa` : `${(minutes / 60).toFixed(1).replace('.0', '')} soat`;
        await ctx.reply(`✅ <b>Avto-post intervali muvaffaqiyatli o‘rnatildi!</b>\n\n` +
            `⏱ Yangi interval: <b>Har ${desc}da</b> kanal(lar)ga avtomatik test joylanadi.`, { reply_markup: (0, keyboards_1.getMainAdminKeyboard)(), parse_mode: 'HTML' });
        return;
    }
    await next();
});
exports.commandsComposer.command('start', async (ctx) => {
    const text = (`🤖 <b>O‘zbekiston Huquqi AI Autonomous Content Agent Botiga Xush Kelibsiz!</b>\n\n` +
        `Ushbu bot avtomatik ravishda O‘zbekiston Respublikasi qonunchiligiga oid ` +
        `professional testlar tayyorlab, Telegram kanallaringizga joylaydi.\n\n` +
        `Boshqaruv panelini ochish uchun /admin buyrug'ini yuboring.`);
    await ctx.reply(text, { reply_markup: (0, keyboards_1.getMainAdminKeyboard)(), parse_mode: 'HTML' });
});
exports.commandsComposer.command('admin', async (ctx) => {
    await renderDashboard(ctx);
});
exports.commandsComposer.hears('⚙️ SOZLAMALAR', async (ctx) => {
    await renderDashboard(ctx);
});
async function renderDashboard(ctx) {
    const stats = await schema_1.repository.getStatistics();
    const autoOnStr = await schema_1.repository.getSetting('auto_post_enabled', String(env_1.env.AUTO_POST));
    const isAuto = autoOnStr.toLowerCase() === 'true';
    const dashboard = (`━━━━━━━━━━━━━━━━━━━━\n` +
        `⚖️ <b>HUQUQIY AI CONTENT AGENT</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 <b>Bugungi testlar:</b> ${stats.todayTotalCount} ta (Avto: ${stats.todayAutoCount}, Qo'lda: ${stats.todayManualCount})\n` +
        `📚 <b>Jami testlar:</b> ${stats.totalCount} ta\n` +
        `🤖 <b>AI Agent holati:</b> ${isAuto ? '🟢 ON' : '🔴 OFF'}\n` +
        `📢 <b>Kanallar:</b> ${stats.activeChannels} ta faol (Jami: ${stats.totalChannels} ta)\n\n` +
        `Boshqarish uchun quyidagi tugmalardan foydalaning:`);
    await ctx.reply(dashboard, { reply_markup: (0, keyboards_1.getMainAdminKeyboard)(), parse_mode: 'HTML' });
}
// Channels Management
exports.commandsComposer.hears('📢 KANALLAR', async (ctx) => {
    await (0, admin_1.renderChannelsCard)(ctx);
});
exports.commandsComposer.command(['channels', 'kanallar'], async (ctx) => {
    await (0, admin_1.renderChannelsCard)(ctx);
});
exports.commandsComposer.command('newtest', async (ctx) => {
    await ctx.reply('📚 <b>Test yaratish uchun huquqiy mavzuni tanlang:</b>', {
        reply_markup: (0, keyboards_1.getTopicPickerKeyboard)(),
        parse_mode: 'HTML',
    });
});
exports.commandsComposer.hears('➕ YANGI TEST', async (ctx) => {
    await ctx.reply('📚 <b>Test yaratish uchun huquqiy mavzuni tanlang:</b>', {
        reply_markup: (0, keyboards_1.getTopicPickerKeyboard)(),
        parse_mode: 'HTML',
    });
});
exports.commandsComposer.command('post', async (ctx) => {
    await handlePostNow(ctx);
});
exports.commandsComposer.hears('🚀 HOZIR JOYLASH', async (ctx) => {
    await handlePostNow(ctx);
});
async function handlePostNow(ctx) {
    const statusMsg = await ctx.reply(`🚀 <b>HOZIR JOYLASH jarayoni boshlandi:</b>\n` +
        `1. AI mavzu va qonuniy faktlarni izlamoqda...\n` +
        `2. Test va izoh yaratilmoqda...\n` +
        `3. AI Fact-Checker tekshirmoqda...\n` +
        `4. Telegram kanallarga yuborilmoqda...`, { parse_mode: 'HTML' });
    const result = await agent_1.agent.runPipeline({
        requestedTopic: undefined,
        isAuto: false,
        publishImmediately: true,
    });
    if (result.success && result.test) {
        const text = (`✅ <b>TEST DARHOL KANALLARGA JOYLANDI!</b>\n\n` +
            `<b>Test ID:</b> #${result.test.id}\n` +
            `<b>Mavzu:</b> ${result.test.topic}\n` +
            `<b>Savol:</b> ${result.test.question.substring(0, 100)}...\n\n` +
            `<i>${result.message}</i>`);
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, text, { parse_mode: 'HTML' });
    }
    else {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ <b>Hozir joylashda xatolik:</b>\n${result.message}`, { parse_mode: 'HTML' });
    }
}
exports.commandsComposer.command('auto', async (ctx) => {
    await renderAutoPostMenu(ctx);
});
exports.commandsComposer.hears('⏰ AVTO POST', async (ctx) => {
    await renderAutoPostMenu(ctx);
});
async function renderAutoPostMenu(ctx) {
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
    await ctx.reply(text, { reply_markup: (0, keyboards_1.getAutoPostKeyboard)(isAuto, isQuiet, isPeak), parse_mode: 'HTML' });
}
exports.commandsComposer.command('stats', async (ctx) => {
    await renderStats(ctx);
});
exports.commandsComposer.hears('📊 STATISTIKA', async (ctx) => {
    await renderStats(ctx);
});
async function renderStats(ctx) {
    const stats = await schema_1.repository.getStatistics();
    const topicLines = [];
    if (stats.topicDistribution) {
        for (const [top, cnt] of Object.entries(stats.topicDistribution)) {
            const icon = topicSelector_1.TOPIC_ICONS[top] || '⚖️';
            topicLines.push(`  ${icon} ${top}: ${cnt} ta`);
        }
    }
    const topicStr = topicLines.length > 0 ? topicLines.join('\n') : "  Ma'lumot yo'q";
    const text = (`📊 <b>AGENT STATISTIKA DASHBOARD</b>\n\n` +
        `📅 <b>Bugun:</b>\n` +
        `• Avtomatik testlar: ${stats.todayAutoCount} ta\n` +
        `• Qo'lda chiqarilgan: ${stats.todayManualCount} ta\n` +
        `• Jami bugun: ${stats.todayTotalCount} ta\n\n` +
        `📆 <b>Oxirgi 7 kun:</b>\n` +
        `• Jami haftalik: ${stats.weekTotalCount} ta\n` +
        `• Eng ko'p ishlatilgan mavzu: 🏆 ${stats.mostUsedTopic}\n\n` +
        `📈 <b>Umumiy ko'rsatkichlar:</b>\n` +
        `• Jami yaratilgan testlar: ${stats.totalCount} ta\n` +
        `• Muvaffaqiyatli postlar: ${stats.publishedCount} ta\n` +
        `• AI Test generatsiyalari: ${stats.aiGenerationCount} marta\n` +
        `• Takroriy (Duplicate) oldi olingan: 🛡 ${stats.duplicatePreventedCount} ta\n` +
        `• Faol kanallar: 📢 ${stats.activeChannels} / ${stats.totalChannels} ta\n\n` +
        `📚 <b>Mavzular bo'yicha taqsimot:</b>\n${topicStr}`);
    await ctx.reply(text, { reply_markup: (0, keyboards_1.getMainAdminKeyboard)(), parse_mode: 'HTML' });
}
exports.commandsComposer.command('history', async (ctx) => {
    await renderHistory(ctx);
});
exports.commandsComposer.hears('📝 TESTLAR', async (ctx) => {
    await renderHistory(ctx);
});
async function renderHistory(ctx) {
    const { items, total } = await schema_1.repository.getRecentTests('all', undefined, 10, 0);
    if (!items || items.length === 0) {
        await ctx.reply('📝 <b>Testlar tarixi bo\'sh.</b>', { reply_markup: (0, keyboards_1.getHistoryFilterKeyboard)(), parse_mode: 'HTML' });
        return;
    }
    const lines = [`📝 <b>Testlar tarixi - Jami: ${total} ta</b>\n`];
    for (const it of items) {
        const statusIcon = it.status === 'published' ? '✅' : it.status === 'pending_approval' ? '⏳' : '❌';
        lines.push(`${statusIcon} <b>#${it.id}</b> [${it.topic}] - <i>${it.createdAt.toISOString().substring(0, 16)}</i>\n   ❓ ${it.question.substring(0, 50)}...\n`);
    }
    await ctx.reply(lines.join('\n'), { reply_markup: (0, keyboards_1.getHistoryFilterKeyboard)(), parse_mode: 'HTML' });
}
exports.commandsComposer.hears('📚 MAVZULAR', async (ctx) => {
    const counts = await schema_1.repository.getTopicCounts();
    const lines = ['📚 <b>O‘zbekiston Huquqi Mavzulari:</b>\n'];
    topicSelector_1.LEGAL_TOPICS.forEach((top, idx) => {
        const icon = topicSelector_1.TOPIC_ICONS[top] || '⚖️';
        const cnt = counts[top] || 0;
        lines.push(`${idx + 1}. ${icon} <b>${top}</b> (${cnt} ta post)`);
    });
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
});
exports.commandsComposer.command('stop', async (ctx) => {
    await scheduler_1.scheduler.setAutoStatus(false);
    await ctx.reply('🔴 <b>Avtomatik posting to\'xtatildi (/resume orqali qayta yoqishingiz mumkin).</b>', { parse_mode: 'HTML' });
});
exports.commandsComposer.command('resume', async (ctx) => {
    await scheduler_1.scheduler.setAutoStatus(true);
    await ctx.reply('🟢 <b>Avtomatik posting qayta yoqildi!</b>', { parse_mode: 'HTML' });
});
