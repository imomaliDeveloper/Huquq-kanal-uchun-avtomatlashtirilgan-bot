import { Composer } from 'grammy';
import { agent } from '../agent/agent';
import { repository } from '../database/schema';
import { scheduler } from '../scheduler/scheduler';
import {
  getMainAdminKeyboard,
  getTopicPickerKeyboard,
  getAutoPostKeyboard,
  getHistoryFilterKeyboard,
  getStudentKeyboard,
} from './keyboards';
import { adminState, renderChannelsCard } from './admin';
import {
  monitoringState,
  renderMonitoringDashboard,
  renderStudentsDirectory,
  renderLeaderboardView,
  renderStudentMyStats,
  renderStudentUnsolvedTests,
} from './monitoring';
import { LEGAL_TOPICS, TOPIC_ICONS } from '../agent/topicSelector';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const commandsComposer = new Composer();

// Helper: check if user is admin
function isAdmin(ctx: any): boolean {
  if (!env.ADMIN_ID) return true;
  return ctx.from?.id === env.ADMIN_ID;
}

// Interactive state interceptor (adding channel, custom interval, student registration, student message)
commandsComposer.on('message:text', async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return await next();
  const text = ctx.message.text.trim();

  // 1. Channel Addition
  if (adminState[userId]?.step === 'awaiting_channel_id') {
    if (text === '/cancel' || text.toLowerCase() === 'bekor qilish') {
      delete adminState[userId];
      await ctx.reply('❌ Kanal qo‘shish bekor qilindi.', { reply_markup: getMainAdminKeyboard() });
      return;
    }

    let cleanId = text;
    if (cleanId.startsWith('https://t.me/')) cleanId = '@' + cleanId.replace('https://t.me/', '');
    if (cleanId.startsWith('t.me/')) cleanId = '@' + cleanId.replace('t.me/', '');
    if (!cleanId.startsWith('@') && !cleanId.startsWith('-')) cleanId = '@' + cleanId;

    await ctx.reply('⏳ Kanal tekshirilmoqda, iltimos kuting...');

    try {
      const chat = await ctx.api.getChat(cleanId);
      const title = (chat as any).title || cleanId;
      if ((chat as any).username) {
        cleanId = '@' + (chat as any).username;
      }

      await repository.addChannel(cleanId, title);
      delete adminState[userId];

      await ctx.reply(
        `✅ <b>Kanal muvaffaqiyatli qo‘shildi va faollashtirildi!</b>\n\n` +
        `📌 <b>Nomi:</b> ${title}\n` +
        `🆔 <b>Manzili:</b> <code>${cleanId}</code>\n\n` +
        `Endi ushbu kanalga ham yangi testlar avtomatik va qo'lda joylanadi.`,
        { reply_markup: getMainAdminKeyboard(), parse_mode: 'HTML' }
      );
      await renderChannelsCard(ctx);
      return;
    } catch (err: any) {
      await ctx.reply(
        `❌ <b>Kanalga ulanib bo‘lmadi!</b>\n\n` +
        `<i>Xatolik:</i> ${err?.message || err}\n\n` +
        `⚠️ <b>Quyidagilarni tekshiring:</b>\n` +
        `1. Botni ushbu kanalga <b>Administrator</b> qilib qo‘shganingizga ishonch hosil qiling.\n` +
        `2. Botga <b>Xabarlar joylash (Post Messages)</b> ruxsati berilgan bo‘lishi shart.\n` +
        `3. Kanal username yoki ID-si to‘g‘ri yozilganini tekshiring.\n\n` +
        `Qaytadan yuboring yoki bekor qilish uchun /cancel deb yozing:`,
        { parse_mode: 'HTML' }
      );
      return;
    }
  }

  // 2. Custom Interval Input
  if (adminState[userId]?.step === 'awaiting_custom_interval') {
    if (text === '/cancel' || text.toLowerCase() === 'bekor qilish') {
      delete adminState[userId];
      await ctx.reply('❌ Interval kiritish bekor qilindi.', { reply_markup: getMainAdminKeyboard() });
      return;
    }

    const minutes = parseInt(text, 10);
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      await ctx.reply(
        '⚠️ <b>Noto‘g‘ri format!</b>\n\n' +
        'Iltimos, 1 dan 1440 gacha bo‘lgan musbat butun son kiriting (masalan: <code>1</code>, <code>5</code>, <code>10</code>):\n\n' +
        'Bekor qilish uchun: /cancel',
        { parse_mode: 'HTML' }
      );
      return;
    }

    delete adminState[userId];
    await scheduler.setIntervalMinutes(minutes);

    const desc = minutes < 60 ? `${minutes} daqiqa` : `${(minutes / 60).toFixed(1).replace('.0', '')} soat`;
    await ctx.reply(
      `✅ <b>Avto-post intervali muvaffaqiyatli o‘rnatildi!</b>\n\n` +
      `⏱ Yangi interval: <b>Har ${desc}da</b> kanal(lar)ga avtomatik test joylanadi.`,
      { reply_markup: getMainAdminKeyboard(), parse_mode: 'HTML' }
    );
    return;
  }

  // 3. Student Registration: Step 1 (Full Name)
  if (monitoringState[userId]?.step === 'awaiting_student_name') {
    if (text.length < 3) {
      await ctx.reply('⚠️ Iltimos, ism va familiyangizni to‘liq yozing (masalan: <i>Ali Valiyev</i>):', { parse_mode: 'HTML' });
      return;
    }

    monitoringState[userId] = {
      step: 'awaiting_student_grade',
      fullName: text,
    };

    await ctx.reply(
      `Rahmat, <b>${text}</b>!\n\n` +
      `Endi <b>Sinfingiz yoki Guruhingizni</b> kiriting (masalan: <i>10-A</i>, <i>9-B</i> yoki <i>Huquq-1</i>. Agar bo‘lmasa <i>yo‘q</i> deb yozing):`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 4. Student Registration: Step 2 (Grade / Group)
  if (monitoringState[userId]?.step === 'awaiting_student_grade') {
    const fullName = monitoringState[userId].fullName;
    const grade = (text.toLowerCase() === 'yo‘q' || text.toLowerCase() === "yo'q" || text === '-') ? '' : text;

    delete monitoringState[userId];

    const username = ctx.from?.username || '';
    await repository.registerStudent(String(userId), fullName, undefined, grade);

    await ctx.reply(
      `✅ <b>TABRIKLAYMIZ! Siz muvaffaqiyatli ro‘yxatdan o‘tdingiz!</b> 🎓\n\n` +
      `📌 <b>O‘quvchi:</b> ${fullName}\n` +
      (grade ? `🏫 <b>Sinf/Guruh:</b> ${grade}\n\n` : '\n') +
      `Endi siz kanaldagi va botdagi barcha testlarni yechishingiz mumkin. Har bir topshirgan testingiz o‘qituvchi tomonidan nazorat qilinadi va umumiy reytingingiz shakllanadi.\n\n` +
      `Quyidagi menyu orqali testlarni yechishni boshlashingiz mumkin:`,
      { reply_markup: getStudentKeyboard(), parse_mode: 'HTML' }
    );
    return;
  }

  // 5. Admin sends direct message to a student
  if (monitoringState[userId]?.step === 'awaiting_student_message') {
    if (text === '/cancel' || text.toLowerCase() === 'bekor qilish') {
      delete monitoringState[userId];
      await ctx.reply('❌ Xabar yuborish bekor qilindi.', { reply_markup: getMainAdminKeyboard() });
      return;
    }

    const targetStudentId = monitoringState[userId].targetStudentId;
    delete monitoringState[userId];

    const student = await repository.getStudentById(targetStudentId);
    if (!student) {
      await ctx.reply('⚠️ O‘quvchi topilmadi.', { reply_markup: getMainAdminKeyboard() });
      return;
    }

    try {
      await ctx.api.sendMessage(
        student.telegramId,
        `📩 <b>O‘QITUVCHINGIZDAN XABAR:</b>\n\n${text}\n\n<i>— O‘qituvchi nazorat tizimi</i>`,
        { parse_mode: 'HTML' }
      );
      await ctx.reply(`✅ <b>Xabar ${student.fullName}ga muvaffaqiyatli yetkazildi!</b>`, {
        reply_markup: getMainAdminKeyboard(),
        parse_mode: 'HTML',
      });
    } catch (err: any) {
      await ctx.reply(`❌ <b>Xabar yetkazilmadi:</b> ${err?.message || err}\n(O‘quvchi botni bloklagan bo‘lishi mumkin)`, {
        reply_markup: getMainAdminKeyboard(),
        parse_mode: 'HTML',
      });
    }
    return;
  }

  await next();
});

// START Command
commandsComposer.command('start', async (ctx) => {
  const userId = ctx.from?.id;

  if (isAdmin(ctx)) {
    const text = (
      `🤖 <b>O‘zbekiston Huquqi AI Nazorat & Content Agent Tizimiga Xush Kelibsiz!</b>\n\n` +
      `Ushbu bot qonunchilikka oid testlarni avtomatik yaratib kanallarga joylaydi va ` +
      `<b>barcha o‘quvchilarning testlarni qanday yechayotganini qat’iy nazorat qiladi</b>.\n\n` +
      `Quyidagi boshqaruv panelidan foydalaning:`
    );
    await ctx.reply(text, { reply_markup: getMainAdminKeyboard(), parse_mode: 'HTML' });
    return;
  }

  // For Students
  if (userId) {
    const student = await repository.getStudentByTelegramId(String(userId));
    if (!student || !student.isRegistered) {
      monitoringState[userId] = { step: 'awaiting_student_name' };
      const welcome = (
        `Assalomu alaykum! 🎓 <b>Huquqiy Ta’lim va Nazorat Tizimiga xush kelibsiz!</b>\n\n` +
        `Ushbu bot orqali siz huquq fani bo‘yicha testlarni yechishingiz va bilimingizni mustahkamlashingiz mumkin.\n\n` +
        `O‘qituvchingiz natijalaringizni ko‘rib borishi va davomatingizni nazorat qilishi uchun, iltimos, <b>Ism va Familiyangizni</b> kiriting (masalan: <i>Ali Valiyev</i>):`
      );
      await ctx.reply(welcome, { parse_mode: 'HTML' });
      return;
    }

    const welcomeBack = (
      `Assalomu alaykum, <b>${student.fullName}</b>! 🎓\n\n` +
      `O‘quvchi profilingiz faol holatda.\n` +
      `Quyidagi menyu orqali yechilmagan testlarni topshirishingiz, o‘z natijalaringizni ko‘rishingiz yoki umumiy reyting bilan tanishishingiz mumkin:`
    );
    await ctx.reply(welcomeBack, { reply_markup: getStudentKeyboard(), parse_mode: 'HTML' });
  }
});

// ==========================================
// STUDENT ACTIONS (Public for registered students)
// ==========================================

commandsComposer.hears('📝 YECHILMAGAN TESTLAR', async (ctx) => {
  await renderStudentUnsolvedTests(ctx);
});

commandsComposer.hears('📊 MENING NATIJALARIM', async (ctx) => {
  await renderStudentMyStats(ctx);
});

commandsComposer.hears(['🏆 REYTING', '🏆 O‘QUVCHILAR REYTINGI'], async (ctx) => {
  await renderLeaderboardView(ctx);
});

commandsComposer.hears('👤 PROFILIM', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const student = await repository.getStudentByTelegramId(String(userId));
  if (!student || !student.isRegistered) {
    monitoringState[userId] = { step: 'awaiting_student_name' };
    await ctx.reply('⚠️ Profilingiz to‘liq emas. Iltimos, ism va familiyangizni kiriting:');
    return;
  }

  const text = (
    `👤 <b>SIZNING PROFILINGIZ:</b>\n\n` +
    `📌 <b>F.I.SH:</b> ${student.fullName}\n` +
    `🏫 <b>Sinf/Guruh:</b> ${student.grade || 'Ko‘rsatilmagan'}\n` +
    `🆔 <b>ID:</b> <code>${student.telegramId}</code>\n` +
    `📅 <b>Ro‘yxatdan o‘tgan sana:</b> ${student.createdAt.toLocaleDateString('uz-UZ')}\n\n` +
    `<i>Agar ma’lumotlaringizni yangilamoqchi bo‘lsangiz, /start buyrug‘ini bosing.</i>`
  );
  await ctx.reply(text, { reply_markup: getStudentKeyboard(), parse_mode: 'HTML' });
});

// ==========================================
// ADMIN ACTIONS (Restricted to ADMIN_ID)
// ==========================================

// Middleware for Admin Commands
commandsComposer.use(async (ctx, next) => {
  if (!isAdmin(ctx)) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⚠️ Kechirasiz, bu amal faqat o‘qituvchi/administrator uchun!', show_alert: true });
    } else {
      await ctx.reply('⚠️ Kechirasiz, bu bo‘lim faqat Administrator uchun ochiq.', { reply_markup: getStudentKeyboard() });
    }
    return;
  }
  await next();
});

commandsComposer.command('admin', async (ctx) => {
  await renderDashboard(ctx);
});

commandsComposer.hears('⚙️ SOZLAMALAR', async (ctx) => {
  await renderDashboard(ctx);
});

// Students Monitoring & Control
commandsComposer.hears('👥 O‘QUVCHILAR NAZORATI', async (ctx) => {
  await renderStudentsDirectory(ctx);
});

commandsComposer.command(['students', 'oquvchilar'], async (ctx) => {
  await renderStudentsDirectory(ctx);
});

commandsComposer.hears('📊 MONITORING (KIM YECHDI?)', async (ctx) => {
  await renderMonitoringDashboard(ctx);
});

commandsComposer.command(['monitoring', 'nazorat'], async (ctx) => {
  await renderMonitoringDashboard(ctx);
});

commandsComposer.command(['daily_stats', 'kunlik_statistika'], async (ctx) => {
  const statusMsg = await ctx.reply('⏳ <b>Kunlik statistika kanallarga yuborilmoqda...</b>', { parse_mode: 'HTML' });
  const { publishDailyStatsToChannels } = await import('./monitoring');
  const res = await publishDailyStatsToChannels();
  if (res.success) {
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `✅ <b>Kunlik statistika kanalga joylandi!</b>\n\n${res.summary}`, { parse_mode: 'HTML' });
  } else {
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ <b>Kanalga chiqarishda xatolik:</b>\n${res.summary}`, { parse_mode: 'HTML' });
  }
});

async function renderDashboard(ctx: any) {
  const stats = await repository.getStatistics();
  const autoOnStr = await repository.getSetting('auto_post_enabled', String(env.AUTO_POST));
  const isAuto = autoOnStr.toLowerCase() === 'true';

  const allStudents = await repository.getAllStudents(false);

  const dashboard = (
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚖️ <b>HUQUQIY AI AGENT & NAZORAT DASHBOARD</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👥 <b>O‘quvchilar soni:</b> ${allStudents.length} ta ro‘yxatda\n` +
    `📊 <b>Bugungi testlar:</b> ${stats.todayTotalCount} ta (Avto: ${stats.todayAutoCount}, Qo'lda: ${stats.todayManualCount})\n` +
    `📚 <b>Jami testlar bazasida:</b> ${stats.totalCount} ta\n` +
    `🤖 <b>AI Agent holati:</b> ${isAuto ? '🟢 ON' : '🔴 OFF'}\n` +
    `📢 <b>Ulangan kanallar:</b> ${stats.activeChannels} ta faol / ${stats.totalChannels} ta jami\n\n` +
    `Boshqarish va o‘quvchilarni nazorat qilish uchun quyidagi tugmalardan foydalaning:`
  );
  await ctx.reply(dashboard, { reply_markup: getMainAdminKeyboard(), parse_mode: 'HTML' });
}

// Channels Management
commandsComposer.hears('📢 KANALLAR', async (ctx) => {
  await renderChannelsCard(ctx);
});

commandsComposer.command(['channels', 'kanallar'], async (ctx) => {
  await renderChannelsCard(ctx);
});

commandsComposer.command('newtest', async (ctx) => {
  await ctx.reply('📚 <b>Test yaratish uchun huquqiy mavzuni tanlang:</b>', {
    reply_markup: getTopicPickerKeyboard(),
    parse_mode: 'HTML',
  });
});

commandsComposer.hears('➕ YANGI TEST', async (ctx) => {
  await ctx.reply('📚 <b>Test yaratish uchun huquqiy mavzuni tanlang:</b>', {
    reply_markup: getTopicPickerKeyboard(),
    parse_mode: 'HTML',
  });
});

commandsComposer.command('post', async (ctx) => {
  await handlePostNow(ctx);
});

commandsComposer.hears('🚀 HOZIR JOYLASH', async (ctx) => {
  await handlePostNow(ctx);
});

async function handlePostNow(ctx: any) {
  const statusMsg = await ctx.reply(
    `🚀 <b>HOZIR JOYLASH jarayoni boshlandi:</b>\n` +
    `1. AI mavzu va qonuniy faktlarni izlamoqda...\n` +
    `2. Test va izoh yaratilmoqda...\n` +
    `3. AI Fact-Checker tekshirmoqda...\n` +
    `4. Telegram kanallarga yuborilmoqda...`,
    { parse_mode: 'HTML' }
  );

  const result = await agent.runPipeline({
    requestedTopic: undefined,
    isAuto: false,
    publishImmediately: true,
  });

  if (result.success && result.test) {
    const text = (
      `✅ <b>TEST DARHOL KANALLARGA JOYLANDI!</b>\n\n` +
      `<b>Test ID:</b> #${result.test.id}\n` +
      `<b>Mavzu:</b> ${result.test.topic}\n` +
      `<b>Savol:</b> ${result.test.question.substring(0, 100)}...\n\n` +
      `<i>${result.message}</i>\n\n` +
      `💡 <i>Endi o‘quvchilar bu testni yechishi bilan "📊 MONITORING (KIM YECHDI?)" bo‘limida ularning natijalari ko‘rinadi.</i>`
    );
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, text, { parse_mode: 'HTML' });
  } else {
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ <b>Hozir joylashda xatolik:</b>\n${result.message}`, { parse_mode: 'HTML' });
  }
}

commandsComposer.command('auto', async (ctx) => {
  await renderAutoPostMenu(ctx);
});

commandsComposer.hears('⏰ AVTO POST', async (ctx) => {
  await renderAutoPostMenu(ctx);
});

async function renderAutoPostMenu(ctx: any) {
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
  await ctx.reply(text, { reply_markup: getAutoPostKeyboard(isAuto, isQuiet, isPeak), parse_mode: 'HTML' });
}

commandsComposer.command('stats', async (ctx) => {
  await renderStats(ctx);
});

commandsComposer.hears('📊 STATISTIKA', async (ctx) => {
  await renderStats(ctx);
});

async function renderStats(ctx: any) {
  const stats = await repository.getStatistics();
  const topicLines: string[] = [];

  if (stats.topicDistribution) {
    for (const [top, cnt] of Object.entries(stats.topicDistribution)) {
      const icon = TOPIC_ICONS[top] || '⚖️';
      topicLines.push(`  ${icon} ${top}: ${cnt} ta`);
    }
  }

  const topicStr = topicLines.length > 0 ? topicLines.join('\n') : "  Ma'lumot yo'q";

  const text = (
    `📊 <b>AGENT STATISTIKA DASHBOARD</b>\n\n` +
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
    `📚 <b>Mavzular bo'yicha taqsimot:</b>\n${topicStr}`
  );
  await ctx.reply(text, { reply_markup: getMainAdminKeyboard(), parse_mode: 'HTML' });
}

commandsComposer.command('history', async (ctx) => {
  await renderHistory(ctx);
});

commandsComposer.hears('📝 TESTLAR', async (ctx) => {
  await renderHistory(ctx);
});

async function renderHistory(ctx: any) {
  const { items, total } = await repository.getRecentTests('all', undefined, 10, 0);

  if (!items || items.length === 0) {
    await ctx.reply('📝 <b>Testlar tarixi:</b>\nHozircha yaratilgan testlar mavjud emas.', { parse_mode: 'HTML' });
    return;
  }

  const lines = [`📝 <b>So‘nggi testlar tarixi (Jami: ${total} ta):</b>\n`];
  for (const it of items) {
    const statusIcon = it.status === 'published' ? '✅' : it.status === 'pending_approval' ? '⏳' : '❌';
    lines.push(`${statusIcon} <b>#${it.id}</b> [${it.topic}] - <i>${it.createdAt.toISOString().substring(0, 16)}</i>\n   ❓ ${it.question.substring(0, 50)}...\n`);
  }

  await ctx.reply(lines.join('\n'), { reply_markup: getHistoryFilterKeyboard(), parse_mode: 'HTML' });
}
