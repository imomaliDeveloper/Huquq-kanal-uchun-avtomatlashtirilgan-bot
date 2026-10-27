import { Keyboard, InlineKeyboard } from 'grammy';
import { LEGAL_TOPICS, TOPIC_ICONS } from '../agent/topicSelector';
import { Channel, Student, Test } from '@prisma/client';

export function getMainAdminKeyboard(): Keyboard {
  return new Keyboard()
    .text('➕ YANGI TEST').text('🚀 HOZIR JOYLASH').row()
    .text('👥 O‘QUVCHILAR NAZORATI').text('📊 MONITORING (KIM YECHDI?)').row()
    .text('📢 KANALLAR').text('⏰ AVTO POST').row()
    .text('🏆 REYTING').text('📝 TESTLAR').row()
    .text('📊 STATISTIKA').text('⚙️ SOZLAMALAR')
    .resized()
    .persistent();
}

export function getStudentKeyboard(): Keyboard {
  return new Keyboard()
    .text('📝 YECHILMAGAN TESTLAR').text('📊 MENING NATIJALARIM').row()
    .text('🏆 REYTING').text('👤 PROFILIM')
    .resized()
    .persistent();
}

export function getTopicPickerKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const topic of LEGAL_TOPICS) {
    const icon = TOPIC_ICONS[topic] || '⚖️';
    kb.text(`${icon} ${topic}`, `topic:${topic}`).row();
  }
  kb.text('🎲 Tasodifiy mavzu', 'topic:random').row();
  kb.text('❌ Bekor qilish', 'action:cancel');
  return kb;
}

export function getPreviewKeyboard(testId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('🚀 KANALGA JOYLASH', `publish:${testId}`).row()
    .text('🔄 QAYTA YARATISH', `regen:${testId}`).row()
    .text('❌ BEKOR QILISH', `reject:${testId}`);
}

export function getPublishTargetKeyboard(testId: number, activeChannels: Channel[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(`🌐 Barcha faol kanallarga (${activeChannels.length} ta)`, `pub_to:${testId}:all`).row();
  for (const ch of activeChannels) {
    kb.text(`📢 ${ch.title || ch.channelId}`, `pub_to:${testId}:${ch.id}`).row();
  }
  kb.text('❌ Bekor qilish', 'action:cancel');
  return kb;
}

export function getChannelsManagementKeyboard(channels: Channel[]): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (channels.length > 0) {
    for (const ch of channels) {
      const statusIcon = ch.isActive ? '🟢' : '⏸️';
      const actionText = ch.isActive ? 'Pauza qilish' : 'Faollashtirish';
      kb.text(
        `${statusIcon} ${ch.title || ch.channelId} (${actionText})`,
        `ch_toggle:${ch.id}`
      );
      kb.text('🗑️', `ch_del:${ch.id}`).row();
    }
  }

  kb.text('➕ Kanal qo‘shish', 'ch_add').row();
  kb.text('🔄 Yangilash', 'ch_refresh').text('🔙 Bosh menyu', 'admin_menu');
  return kb;
}

export function getAutoPostKeyboard(isEnabled: boolean, quietEnabled: boolean, peakEnabled: boolean): InlineKeyboard {
  const toggleBtnText = isEnabled ? '🔴 AVTO-POSTNI O‘CHIRISH' : '🟢 AVTO-POSTNI YOQISH';
  const toggleData = isEnabled ? 'auto_toggle:off' : 'auto_toggle:on';

  const quietText = quietEnabled ? '🌙 Tungi Jimlik (23:00 - 07:00): YOQILGAN' : '🌙 Tungi Jimlik: O‘CHIRILGAN';
  const quietData = quietEnabled ? 'quiet_toggle:off' : 'quiet_toggle:on';

  const peakText = peakEnabled ? '⭐ Peak Rejimi (09,13,18,21): YOQILGAN' : '⭐ Peak Rejimi: O‘CHIRILGAN';
  const peakData = peakEnabled ? 'peak_toggle:off' : 'peak_toggle:on';

  return new InlineKeyboard()
    .text(toggleBtnText, toggleData).row()
    .text(quietText, quietData).row()
    .text(peakText, peakData).row()
    .text('⏱ INTERVALNI O‘ZGARTIRISH', 'auto_change_interval').row()
    .text('🔙 Bosh menyu', 'admin_menu');
}

export function getIntervalPickerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚡ 1 daqiqa', 'set_int_min:1').text('⚡ 5 daqiqa', 'set_int_min:5').row()
    .text('⚡ 10 daqiqa', 'set_int_min:10').text('⚡ 15 daqiqa', 'set_int_min:15').row()
    .text('⏱ 30 daqiqa', 'set_int_min:30').text('⏱ 1 soat', 'set_int_min:60').row()
    .text('⏱ 2 soat', 'set_int_min:120').text('⏱ 3 soat', 'set_int_min:180').row()
    .text('⏱ 6 soat', 'set_int_min:360').text('⏱ 12 soat', 'set_int_min:720').row()
    .text('⏱ 24 soat', 'set_int_min:1440').row()
    .text('✍️ Maxsus daqiqa kiritish', 'set_int_custom').row()
    .text('🔙 Orqaga', 'menu:auto');
}

export function getHistoryFilterKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Bugun', 'hist:today').text('📅 Kecha', 'hist:yesterday').row()
    .text('📅 Hafta', 'hist:week').text('📅 Oy', 'hist:month').row()
    .text('📚 Barcha testlar', 'hist:all');
}

export function getChannelQuizKeyboard(testId: number, channelLink?: string): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('🔹 A', `ans:${testId}:0`).text('🔹 B', `ans:${testId}:1`).row()
    .text('🔹 C', `ans:${testId}:2`).text('🔹 D', `ans:${testId}:3`);

  if (channelLink) {
    let url = channelLink;
    if (url.startsWith('@')) url = `https://t.me/${url.replace('@', '')}`;
    if (url.startsWith('https://t.me/')) {
      kb.row().url('📢 Kanalga a’zo bo‘lish ↗️', url);
    }
  }

  return kb;
}

// --- Monitoring & Student Management Keyboards ---

export function getMonitoringTestPickerKeyboard(tests: Test[]): InlineKeyboard {
  const kb = new InlineKeyboard();

  kb.text('📢 KUNLIK STATISTIKANI KANALGA CHIQARISH ↗️', 'post_daily_stats').row();

  for (const t of tests) {
    const title = `#${t.id}: ${t.topic} (${t.question.substring(0, 30)}...)`;
    kb.text(title, `mon_view:${t.id}`).row();
  }

  kb.text('🔙 Bosh menyu', 'admin_menu');
  return kb;
}

export function getMonitoringKeyboard(testId: number, unsolvedCount: number): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('✅ Yechganlar ro‘yxati', `mon_solved:${testId}`)
    .text('❌ Yechmaganlar ro‘yxati', `mon_unsolved:${testId}`).row();

  if (unsolvedCount > 0) {
    kb.text(`🔔 Yechmaganlarga eslatma yuborish (${unsolvedCount} ta)`, `mon_remind:${testId}`).row();
  }

  kb.text('🔄 Yangilash', `mon_view:${testId}`)
    .text('🔙 Testlar ro‘yxati', 'mon_list');

  return kb;
}

export function getStudentsListKeyboard(students: Student[]): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const st of students.slice(0, 15)) {
    const status = st.isActive ? '🟢' : '⏸️';
    const label = `${status} ${st.fullName || st.telegramId}${st.grade ? ` [${st.grade}]` : ''}`;
    kb.text(label, `stu_view:${st.id}`).row();
  }

  kb.text('➕ O‘quvchi qo‘shish', 'stu_add')
    .text('📊 Umumiy hisobot', 'stu_report').row()
    .text('🔙 Bosh menyu', 'admin_menu');

  return kb;
}

export function getStudentDetailKeyboard(studentId: number, isActive: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  const toggleText = isActive ? '⏸️ Pauza qilish' : '🟢 Faollashtirish';

  kb.text(toggleText, `stu_toggle:${studentId}`)
    .text('✉️ Xabar yuborish', `stu_msg:${studentId}`).row()
    .text('🗑️ O‘chirish', `stu_del:${studentId}`)
    .text('🔙 Ro‘yxatga qaytish', 'stu_list');

  return kb;
}
