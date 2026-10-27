import { Composer, InlineKeyboard } from 'grammy';
import { repository } from '../database/schema';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  getMonitoringKeyboard,
  getMonitoringTestPickerKeyboard,
  getStudentsListKeyboard,
  getStudentDetailKeyboard,
  getChannelQuizKeyboard,
  getStudentKeyboard,
  getMainAdminKeyboard,
} from './keyboards';

export const monitoringComposer = new Composer();

// State for monitoring / student flows
export const monitoringState: Record<number, { step: string; [key: string]: any }> = {};

// Helper: Escape HTML
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==========================================
// 1. INTERACTIVE QUIZ SUBMISSION (PUBLIC)
// ==========================================

monitoringComposer.on('callback_query:data', async (ctx, next) => {
  const data = ctx.callbackQuery.data;

  // Handles 'ans:testId:optionIdx' from channel or private chat
  if (data.startsWith('ans:')) {
    const parts = data.split(':');
    const testId = parseInt(parts[1], 10);
    const chosenIdx = parseInt(parts[2], 10);

    const testItem = await repository.getTestById(testId);
    if (!testItem) {
      await ctx.answerCallbackQuery({ text: '⚠️ Test topilmadi.', show_alert: true });
      return;
    }

    const fromUser = ctx.from;
    const telegramId = String(fromUser.id);
    const fullName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || `Foydalanuvchi_${telegramId}`;
    const username = fromUser.username || '';

    // Upsert student record
    const student = await repository.upsertStudent(telegramId, fullName, username);

    // Check if student already submitted this test
    const existingSubmission = await repository.getSubmission(testId, student.id);
    if (existingSubmission) {
      const letters = ['A', 'B', 'C', 'D'];
      const chosenLetter = letters[existingSubmission.selectedOption] || 'A';
      const correctLetter = letters[testItem.correctAnswer] || 'A';
      const statusText = existingSubmission.isCorrect ? '✅ To‘g‘ri' : '❌ Noto‘g‘ri';

      await ctx.answerCallbackQuery({
        text: `⚠️ Siz bu testga allaqachon javob bergansiz!\n\nTanlagan variantingiz: ${chosenLetter} (${statusText})\nTo‘g‘ri javob: ${correctLetter}\n\nQayta topshirish mumkin emas.`,
        show_alert: true,
      });
      return;
    }

    // Evaluate answer
    const isCorrect = chosenIdx === testItem.correctAnswer;
    await repository.recordSubmission(testId, student.id, chosenIdx, isCorrect);

    const letters = ['A', 'B', 'C', 'D'];
    const optionsText = [testItem.optionA, testItem.optionB, testItem.optionC, testItem.optionD];
    const correctLetter = letters[testItem.correctAnswer] || 'A';
    const chosenLetter = letters[chosenIdx] || 'A';
    const correctOptionContent = optionsText[testItem.correctAnswer] || '';

    let alertMsg = '';
    if (isCorrect) {
      alertMsg = `✅ BARAKALLA! JAVOBINGIZ TO‘G‘RI! (${correctLetter})\n\n`;
      alertMsg += `✅ Javob: ${correctOptionContent}\n\n`;
      if (testItem.explanation) alertMsg += `📚 Izoh: ${testItem.explanation}\n`;
      if (testItem.legalSource) alertMsg += `⚖️ Manba: ${testItem.legalSource}\n`;
    } else {
      alertMsg = `❌ NOTO‘G‘RI JAVOB! (Siz: ${chosenLetter}, To‘g‘ri: ${correctLetter})\n\n`;
      alertMsg += `✅ To‘g‘ri javob: ${correctLetter}) ${correctOptionContent}\n\n`;
      if (testItem.explanation) alertMsg += `📚 Izoh: ${testItem.explanation}\n`;
      if (testItem.legalSource) alertMsg += `⚖️ Manba: ${testItem.legalSource}\n`;
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

  await next();
});

// ==========================================
// 2. ADMIN MONITORING SCREENS
// ==========================================

export async function renderMonitoringDashboard(ctx: any) {
  const { items } = await repository.getRecentTests('all', undefined, 10, 0);

  if (!items || items.length === 0) {
    const text = '📊 <b>TESTLAR MONITORINGI</b>\n\nHozircha e’lon qilingan testlar mavjud emas.';
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML' });
    }
    return;
  }

  const text = (
    `📊 <b>TESTLAR MONITORINGI (KIM YECHDI / KIM YECHMADI?)</b>\n\n` +
    `Quyidagi ro‘yxatdan nazorat qilmoqchi bo‘lgan testingizni tanlang:\n` +
    `<i>Har bir test bo‘yicha kimlar yechgani, kimlar qoldirgani va eslatma yuborish imkoniyati mavjud.</i>`
  );

  const kb = getMonitoringTestPickerKeyboard(items);
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
  } else {
    await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
  }
}

export async function renderTestDetailMonitoring(ctx: any, testId: number) {
  const data = await repository.getTestMonitoringData(testId);
  if (!data) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⚠️ Test topilmadi!', show_alert: true });
    }
    return;
  }

  const { test, totalStudents, solvedCount, unsolvedCount, correctCount, incorrectCount, participationRate } = data;

  const text = (
    `📊 <b>TEST #${test.id} NAZORAT VA MONITORINGI</b>\n\n` +
    `📌 <b>Mavzu:</b> ${escapeHtml(test.topic)}\n` +
    `❓ <b>Savol:</b> ${escapeHtml(test.question)}\n\n` +
    `👥 <b>Jami o‘quvchilar:</b> ${totalStudents} ta\n` +
    `📈 <b>Ishtirok darajasi:</b> ${participationRate}%\n\n` +
    `✅ <b>Testni yechganlar:</b> ${solvedCount} ta\n` +
    `   • 🟢 To‘g‘ri javob: ${correctCount} ta\n` +
    `   • 🔴 Noto‘g‘ri javob: ${incorrectCount} ta\n\n` +
    `❌ <b>Hali yechmaganlar (Qoloqlar):</b> <b>${unsolvedCount} ta</b> ⚠️\n\n` +
    `<i>Quyidagi tugmalar orqali kimlar yechganini ko‘rishingiz yoki yechmagan o‘quvchilarga avtomatik eslatma yuborishingiz mumkin:</i>`
  );

  const kb = getMonitoringKeyboard(testId, unsolvedCount);
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
  } else {
    await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
  }
}

export async function renderSolvedList(ctx: any, testId: number) {
  const data = await repository.getTestMonitoringData(testId);
  if (!data) return;

  const { test, solvedStudents } = data;
  const letters = ['A', 'B', 'C', 'D'];

  let content = `✅ <b>TEST #${test.id} NI YECHGAN O‘QUVCHILAR (${solvedStudents.length} ta):</b>\n\n`;

  if (solvedStudents.length === 0) {
    content += `<i>Ushbu testni hali hech kim yechmadi.</i>`;
  } else {
    solvedStudents.forEach((st, idx) => {
      const statusIcon = st.isCorrect ? '🟢' : '🔴';
      const optionLetter = letters[st.selectedOption] || '?';
      const timeStr = new Date(st.submittedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      const gradeStr = st.grade ? ` [${st.grade}]` : '';
      const userTag = st.username ? ` (@${st.username})` : '';

      content += `${idx + 1}. ${statusIcon} <b>${escapeHtml(st.fullName)}</b>${gradeStr}${userTag}\n`;
      content += `   Javob: <b>${optionLetter}</b> (${st.isCorrect ? 'To‘g‘ri' : 'Noto‘g‘ri'}) | 🕒 ${timeStr}\n\n`;
    });
  }

  const kb = getMonitoringKeyboard(testId, data.unsolvedCount);
  if (ctx.callbackQuery) {
    await ctx.editMessageText(content, { reply_markup: kb, parse_mode: 'HTML' });
  } else {
    await ctx.reply(content, { reply_markup: kb, parse_mode: 'HTML' });
  }
}

export async function renderUnsolvedList(ctx: any, testId: number) {
  const data = await repository.getTestMonitoringData(testId);
  if (!data) return;

  const { test, unsolvedStudents } = data;

  let content = `❌ <b>TEST #${test.id} NI HALI YECHMAGAN O‘QUVCHILAR (${unsolvedStudents.length} ta):</b>\n\n`;

  if (unsolvedStudents.length === 0) {
    content += `🎉 <i>Ajoyib! Barcha o‘quvchilar ushbu testni yechishgan!</i>`;
  } else {
    unsolvedStudents.forEach((st, idx) => {
      const gradeStr = st.grade ? ` [${st.grade}]` : '';
      const userTag = st.username ? ` (@${st.username})` : '';
      content += `${idx + 1}. ⚠️ <b>${escapeHtml(st.fullName)}</b>${gradeStr}${userTag}\n`;
    });
    content += `\n💡 <i>Pastdagi eslatma tugmasini bossangiz, bot yechmagan barcha o‘quvchilarning shaxsiyiga zudlik bilan eslatma xabarini yuboradi.</i>`;
  }

  const kb = getMonitoringKeyboard(testId, data.unsolvedCount);
  if (ctx.callbackQuery) {
    await ctx.editMessageText(content, { reply_markup: kb, parse_mode: 'HTML' });
  } else {
    await ctx.reply(content, { reply_markup: kb, parse_mode: 'HTML' });
  }
}

export async function sendReminderToUnsolved(ctx: any, testId: number) {
  const data = await repository.getTestMonitoringData(testId);
  if (!data) return;

  const { test, unsolvedStudents } = data;

  if (unsolvedStudents.length === 0) {
    await ctx.answerCallbackQuery({ text: 'Barcha o‘quvchilar bu testni allaqachon yechgan!', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '🔔 Eslatmalar yuborilmoqda...' });
  const statusMsg = await ctx.reply(`⏳ <b>${unsolvedStudents.length} ta o‘quvchiga eslatma yuborilmoqda...</b>`, { parse_mode: 'HTML' });

  let successCount = 0;
  let failCount = 0;

  const testKeyboard = getChannelQuizKeyboard(test.id);

  for (const st of unsolvedStudents) {
    try {
      const reminderText = (
        `⚠️ <b>HURMATLI ${escapeHtml(st.fullName).toUpperCase()}!</b>\n\n` +
        `Siz o‘qituvchingiz tomonidan berilgan <b>#${test.id}-sonli</b> huquqiy testni hali yechmadingiz!\n\n` +
        `📚 <b>Mavzu:</b> ${escapeHtml(test.topic)}\n` +
        `❓ <b>Savol:</b> ${escapeHtml(test.question)}\n\n` +
        `A) ${escapeHtml(test.optionA)}\n` +
        `B) ${escapeHtml(test.optionB)}\n` +
        `C) ${escapeHtml(test.optionC)}\n` +
        `D) ${escapeHtml(test.optionD)}\n\n` +
        `👇 <i>Iltimos, zudlik bilan pastdagi variantlardan birini tanlab topshiring:</i>`
      );

      await ctx.api.sendMessage(st.telegramId, reminderText, {
        parse_mode: 'HTML',
        reply_markup: testKeyboard,
      });
      successCount++;
    } catch (err: any) {
      failCount++;
      logger.warn(`Could not send reminder to student ${st.telegramId}: ${err?.message || err}`);
    }
  }

  const resultText = (
    `✅ <b>ESLATMALAR YUBORILDI!</b>\n\n` +
    `Test: <b>#${test.id}</b>\n` +
    `📬 Muvaffaqiyatli yetkazildi: <b>${successCount} ta</b>\n` +
    (failCount > 0 ? `⚠️ Yetkazib bo‘lmadi: <b>${failCount} ta</b> (botni bloklagan bo‘lishi mumkin)\n` : '') +
    `\n<i>O‘quvchilar javob berishi bilan natijalar monitoringda avtomatik yangilanadi.</i>`
  );

  await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, resultText, { parse_mode: 'HTML' });
}

// ==========================================
// 3. STUDENTS MANAGEMENT SCREENS
// ==========================================

export async function renderStudentsDirectory(ctx: any) {
  const students = await repository.getAllStudents(false);

  let text = (
    `👥 <b>O‘QUVCHILAR NAZORATI VA BAZASI</b>\n\n` +
    `Jami o‘quvchilar: <b>${students.length} ta</b>\n\n`
  );

  if (students.length === 0) {
    text += `<i>Hozircha bazada o‘quvchilar yo‘q. O‘quvchilar botga kirib /start bosganlarida yoki test yechganlarida avtomatik qo‘shiladi.</i>`;
  } else {
    text += `<i>Quyidagi ro‘yxatdan o‘quvchini tanlab, uning to‘liq statistikasi, davomati va javoblarini ko‘rishingiz mumkin:</i>`;
  }

  const kb = getStudentsListKeyboard(students);
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
  } else {
    await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
  }
}

export async function renderStudentDetail(ctx: any, studentId: number) {
  const stats = await repository.getStudentStats(studentId);
  if (!stats) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⚠️ O‘quvchi topilmadi!', show_alert: true });
    }
    return;
  }

  const { student, totalTestsCount, solvedCount, correctCount, incorrectCount, unsolvedCount, accuracy } = stats;

  const regStatus = student.isRegistered ? '🟢 To‘liq ro‘yxatdan o‘tgan' : '🟡 Vaqtincha (Kanal orqali)';
  const activeStatus = student.isActive ? '🟢 Faol' : '⏸️ Pauzada / To‘xtatilgan';

  const text = (
    `👤 <b>O‘QUVCHI SHAXSIY KARTASI</b>\n\n` +
    `📌 <b>F.I.SH:</b> ${escapeHtml(student.fullName)}\n` +
    `🆔 <b>Telegram ID:</b> <code>${student.telegramId}</code> ${student.username ? `(@${student.username})` : ''}\n` +
    `🏫 <b>Sinf / Guruh:</b> ${student.grade ? escapeHtml(student.grade) : '<i>Ko‘rsatilmagan</i>'}\n` +
    `📞 <b>Telefon:</b> ${student.phone ? escapeHtml(student.phone) : '<i>Ko‘rsatilmagan</i>'}\n` +
    `📋 <b>Holati:</b> ${regStatus} | ${activeStatus}\n` +
    `📅 <b>Qo‘shilgan vaqt:</b> ${student.createdAt.toLocaleDateString('uz-UZ')}\n\n` +
    `📊 <b>NAZORAT VA O‘ZLASHTIRISH KO‘RSATKICHI:</b>\n` +
    `• Jami e’lon qilingan testlar: <b>${totalTestsCount} ta</b>\n` +
    `• Yechgan testlari: <b>${solvedCount} ta</b>\n` +
    `• To‘g‘ri topilgan: <b>${correctCount} ta</b> 🟢\n` +
    `• Xato qilingan: <b>${incorrectCount} ta</b> 🔴\n` +
    `• Qoldirilgan (yechilmagan): <b>${unsolvedCount} ta</b> ⚠️\n` +
    `• O‘zlashtirish aniqligi: <b>${accuracy}%</b> ⭐`
  );

  const kb = getStudentDetailKeyboard(student.id, student.isActive);
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
  } else {
    await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
  }
}

export async function renderLeaderboardView(ctx: any) {
  const leaderboard = await repository.getLeaderboard(20);

  let text = `🏆 <b>O‘QUVCHILARNING UMUMIY REYTINGI (TOP-20)</b>\n\n`;

  if (leaderboard.length === 0) {
    text += `<i>Hozircha test topshirgan o‘quvchilar yo‘q.</i>`;
  } else {
    leaderboard.forEach((st, idx) => {
      let medal = `${idx + 1}.`;
      if (idx === 0) medal = '🥇 1.';
      else if (idx === 1) medal = '🥈 2.';
      else if (idx === 2) medal = '🥉 3.';

      const gradeStr = st.grade ? ` [${st.grade}]` : '';
      text += `${medal} <b>${escapeHtml(st.fullName)}</b>${gradeStr}\n`;
      text += `   To‘g‘ri javoblar: <b>${st.totalCorrect} ta</b> / ${st.totalSubmitted} ta (${st.accuracy}%)\n\n`;
    });
  }

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'HTML' });
  } else {
    await ctx.reply(text, { parse_mode: 'HTML' });
  }
}

export async function renderStudentsReport(ctx: any) {
  const students = await repository.getAllStudents(false);
  const totalTests = await repository.getRecentTests('all', undefined, 1, 0);

  let report = `📋 <b>O‘QUVCHILARNING UMUMIY NAZORAT HISOBOTI</b>\n\n`;
  report += `📅 Sana: ${new Date().toLocaleDateString('uz-UZ')}\n`;
  report += `📚 Jami testlar: ${totalTests.total} ta\n`;
  report += `👥 Jami o‘quvchilar: ${students.length} ta\n\n`;

  students.forEach((st, i) => {
    const solved = st.submissions.length;
    const correct = st.submissions.filter((s) => s.isCorrect).length;
    const pct = solved > 0 ? Math.round((correct / solved) * 100) : 0;
    const gradeStr = st.grade ? ` [${st.grade}]` : '';

    report += `${i + 1}. <b>${escapeHtml(st.fullName)}</b>${gradeStr}\n`;
    report += `   • Yechdi: ${solved} ta | To‘g‘ri: ${correct} ta (${pct}%)\n`;
  });

  if (ctx.callbackQuery) {
    await ctx.editMessageText(report, { parse_mode: 'HTML' });
  } else {
    await ctx.reply(report, { parse_mode: 'HTML' });
  }
}

// ==========================================
// 4. STUDENT USER COMMANDS (BOT INTERFACE)
// ==========================================

export async function renderStudentMyStats(ctx: any) {
  const telegramId = String(ctx.from?.id);
  const student = await repository.getStudentByTelegramId(telegramId);

  if (!student) {
    await ctx.reply('⚠️ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing.');
    return;
  }

  const stats = await repository.getStudentStats(student.id);
  if (!stats) return;

  const text = (
    `📊 <b>SIZNING SHAXSIY NATIJALARINGIZ:</b>\n\n` +
    `👤 <b>O‘quvchi:</b> ${escapeHtml(student.fullName)}\n` +
    `🏫 <b>Sinf/Guruh:</b> ${student.grade || 'Mavjud emas'}\n\n` +
    `📝 <b>Jami e’lon qilingan testlar:</b> ${stats.totalTestsCount} ta\n` +
    `✅ <b>Siz yechgan testlar:</b> ${stats.solvedCount} ta\n` +
    `🟢 <b>To‘g‘ri javoblar:</b> ${stats.correctCount} ta\n` +
    `🔴 <b>Noto‘g‘ri javoblar:</b> ${stats.incorrectCount} ta\n` +
    `⚠️ <b>Topshirmagan testlaringiz:</b> ${stats.unsolvedCount} ta\n` +
    `⭐ <b>Aniqlik ko‘rsatkichi:</b> ${stats.accuracy}%\n\n` +
    `<i>Bilimingizni oshirish uchun faol bo‘ling va barcha testlarni vaqtida topshiring!</i>`
  );

  await ctx.reply(text, { reply_markup: getStudentKeyboard(), parse_mode: 'HTML' });
}

export async function renderStudentUnsolvedTests(ctx: any) {
  const telegramId = String(ctx.from?.id);
  const student = await repository.getStudentByTelegramId(telegramId);

  if (!student) {
    await ctx.reply('⚠️ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing.');
    return;
  }

  const unsolved = await repository.getUnsolvedTestsForStudent(student.id, 5);

  if (unsolved.length === 0) {
    await ctx.reply('🎉 <b>Ajoyib!</b> Siz barcha testlarni yechgansiz! Yangi testlar e’lon qilinishini kuting.', {
      reply_markup: getStudentKeyboard(),
      parse_mode: 'HTML',
    });
    return;
  }

  await ctx.reply(`📝 <b>Siz hali yechmagan ${unsolved.length} ta test:</b>`, { reply_markup: getStudentKeyboard(), parse_mode: 'HTML' });

  for (const t of unsolved) {
    const text = (
      `⚖️ <b>Mavzu: ${escapeHtml(t.topic)}</b> (Test #${t.id})\n\n` +
      `❓ ${escapeHtml(t.question)}\n\n` +
      `A) ${escapeHtml(t.optionA)}\n` +
      `B) ${escapeHtml(t.optionB)}\n` +
      `C) ${escapeHtml(t.optionC)}\n` +
      `D) ${escapeHtml(t.optionD)}`
    );
    const kb = getChannelQuizKeyboard(t.id);
    await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
  }
}

// ==========================================
// 5. CALLBACK HANDLERS FOR MONITORING
// ==========================================

monitoringComposer.on('callback_query:data', async (ctx, next) => {
  const data = ctx.callbackQuery.data;

  // View specific test monitoring
  if (data.startsWith('mon_view:')) {
    const testId = parseInt(data.split(':')[1], 10);
    await ctx.answerCallbackQuery();
    await renderTestDetailMonitoring(ctx, testId);
    return;
  }

  // Solved list
  if (data.startsWith('mon_solved:')) {
    const testId = parseInt(data.split(':')[1], 10);
    await ctx.answerCallbackQuery();
    await renderSolvedList(ctx, testId);
    return;
  }

  // Unsolved list
  if (data.startsWith('mon_unsolved:')) {
    const testId = parseInt(data.split(':')[1], 10);
    await ctx.answerCallbackQuery();
    await renderUnsolvedList(ctx, testId);
    return;
  }

  // Send reminder
  if (data.startsWith('mon_remind:')) {
    const testId = parseInt(data.split(':')[1], 10);
    await sendReminderToUnsolved(ctx, testId);
    return;
  }

  // Back to monitoring list
  if (data === 'mon_list') {
    await ctx.answerCallbackQuery();
    await renderMonitoringDashboard(ctx);
    return;
  }

  // View student detail
  if (data.startsWith('stu_view:')) {
    const studentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCallbackQuery();
    await renderStudentDetail(ctx, studentId);
    return;
  }

  // Toggle student active status
  if (data.startsWith('stu_toggle:')) {
    const studentId = parseInt(data.split(':')[1], 10);
    const updated = await repository.toggleStudentActive(studentId);
    if (updated) {
      await ctx.answerCallbackQuery({ text: updated.isActive ? '🟢 O‘quvchi faollashtirildi' : '⏸️ O‘quvchi pauzaga qo‘yildi' });
      await renderStudentDetail(ctx, studentId);
    }
    return;
  }

  // Delete student
  if (data.startsWith('stu_del:')) {
    const studentId = parseInt(data.split(':')[1], 10);
    try {
      await repository.deleteStudent(studentId);
      await ctx.answerCallbackQuery({ text: '🗑️ O‘quvchi o‘chirildi' });
      await renderStudentsDirectory(ctx);
    } catch {
      await ctx.answerCallbackQuery({ text: '⚠️ O‘chirishda xatolik' });
    }
    return;
  }

  // Send message to student
  if (data.startsWith('stu_msg:')) {
    const studentId = parseInt(data.split(':')[1], 10);
    const userId = ctx.from?.id;
    if (userId) {
      monitoringState[userId] = { step: 'awaiting_student_message', targetStudentId: studentId };
    }
    await ctx.answerCallbackQuery();
    await ctx.reply('✉️ <b>O‘quvchiga yubormoqchi bo‘lgan xabaringiz matnini yozing:</b>\n\nBekor qilish uchun: /cancel', { parse_mode: 'HTML' });
    return;
  }

  // Students report
  if (data === 'stu_report') {
    await ctx.answerCallbackQuery();
    await renderStudentsReport(ctx);
    return;
  }

  // Back to students directory
  if (data === 'stu_list') {
    await ctx.answerCallbackQuery();
    await renderStudentsDirectory(ctx);
    return;
  }

  // Publish Daily Stats to Channels Immediately
  if (data === 'post_daily_stats') {
    await ctx.answerCallbackQuery({ text: '📢 Kunlik statistika kanallarga chiqarilmoqda...' });
    const statusMsg = await ctx.reply('⏳ <b>Kunlik statistika kanallarga yuborilmoqda...</b>', { parse_mode: 'HTML' });
    const res = await publishDailyStatsToChannels();
    const chatId = ctx.chat?.id;
    if (chatId) {
      if (res.success) {
        await ctx.api.editMessageText(chatId, statusMsg.message_id, `✅ <b>Kunlik statistika kanalga joylandi!</b>\n\n${res.summary}`, { parse_mode: 'HTML' });
      } else {
        await ctx.api.editMessageText(chatId, statusMsg.message_id, `❌ <b>Kanalga chiqarishda xatolik:</b>\n${res.summary}`, { parse_mode: 'HTML' });
      }
    }
    return;
  }

  await next();
});

export async function publishDailyStatsToChannels(): Promise<{ success: boolean; summary: string }> {
  const { getBot } = await import('./bot');
  const bot = getBot();
  if (!bot) {
    return { success: false, summary: 'Bot ishga tushmagan.' };
  }

  const activeChannels = await repository.getActiveChannels();
  if (activeChannels.length === 0 && !env.CHANNEL_ID) {
    return { success: false, summary: 'Hech qanday faol kanal topilmadi.' };
  }

  const targets = activeChannels.length > 0
    ? activeChannels.map((c) => ({ channelId: c.channelId, title: c.title || c.channelId }))
    : [{ channelId: env.CHANNEL_ID, title: env.CHANNEL_ID }];

  const report = await repository.getDailyStudentReport();

  const nowTashkent = new Date(new Date().toLocaleString('en-US', { timeZone: env.TIMEZONE }));
  const currentHour = nowTashkent.getHours();
  const titleHeader = currentHour < 16
    ? '☀️ <b>TUSHLIK O‘QUVCHILAR STATISTIKASI (ORALIQ NATIJALAR)</b>'
    : '🌙 <b>KUN YAKUNI: O‘QUVCHILAR STATISTIKASI VA REYTINGI</b>';

  const dateStr = report.date.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let text = (
    `${titleHeader}\n` +
    `📅 <i>${dateStr}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📈 <b>Bugungi umumiy natijalar:</b>\n` +
    `• Bugun chiqarilgan testlar: <b>${report.todayPublishedTests} ta</b>\n` +
    `• Ro‘yxatdagi jami o‘quvchilar: <b>${report.totalActiveStudents} ta</b>\n` +
    `• Bugun test yechganlar: <b>${report.participatingStudentsCount} ta (${report.participationRate}%)</b>\n` +
    `• Jami berilgan javoblar: <b>${report.totalAnswers} ta</b>\n` +
    `• To‘g‘ri topilgan javoblar: <b>${report.totalCorrectAnswers} ta (${report.averageAccuracy}%)</b>\n\n`
  );

  if (report.topStudents.length === 0) {
    text += `<i>Bugun hali o‘quvchilar tomonidan testlar topshirilmadi.</i>\n\n`;
  } else {
    text += `🏆 <b>BUGUNGI ENG FAOL VA KUCHLI O‘QUVCHILAR:</b>\n`;
    report.topStudents.forEach((item, idx) => {
      let medal = `${idx + 1}.`;
      if (idx === 0) medal = '🥇 1.';
      else if (idx === 1) medal = '🥈 2.';
      else if (idx === 2) medal = '🥉 3.';

      const gradeStr = item.student.grade ? ` [${item.student.grade}]` : '';
      text += `${medal} <b>${escapeHtml(item.student.fullName)}</b>${gradeStr} — <b>${item.correctCount} ta to‘g‘ri</b> (${item.accuracy}%)\n`;
    });
    text += '\n';
  }

  text += (
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <i>O‘quvchilar diqqatiga: Har kuni testlarni o‘z vaqtida yechib, bilimlaringizni oshirib boring!</i>`
  );

  const successChannels: string[] = [];
  const failChannels: string[] = [];

  for (const t of targets) {
    try {
      await bot.api.sendMessage(t.channelId, text, {
        parse_mode: 'HTML',
      });
      successChannels.push(t.title);
    } catch (err: any) {
      failChannels.push(`${t.title} (${err?.message || err})`);
    }
  }

  if (successChannels.length > 0) {
    const summary = `Muvaffaqiyatli: ${successChannels.join(', ')}` + (failChannels.length > 0 ? ` | Xatolik: ${failChannels.join(', ')}` : '');
    return { success: true, summary };
  } else {
    return { success: false, summary: `Xatolik: ${failChannels.join(', ')}` };
  }
}
