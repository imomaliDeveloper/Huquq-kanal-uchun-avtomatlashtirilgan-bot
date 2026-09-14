import { Keyboard, InlineKeyboard } from 'grammy';
import { LEGAL_TOPICS, TOPIC_ICONS } from '../agent/topicSelector';

export function getMainAdminKeyboard(): Keyboard {
  return new Keyboard()
    .text('➕ YANGI TEST').text('🚀 HOZIR JOYLASH').row()
    .text('⏰ AVTO POST').text('📚 MAVZULAR').row()
    .text('📝 TESTLAR').text('📊 STATISTIKA').row()
    .text('⚙️ SOZLAMALAR')
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
    .text('30 daqiqa', 'set_int:0.5').text('1 soat', 'set_int:1.0').row()
    .text('2 soat', 'set_int:2.0').text('3 soat', 'set_int:3.0').row()
    .text('6 soat', 'set_int:6.0').text('12 soat', 'set_int:12.0').row()
    .text('24 soat', 'set_int:24.0').row()
    .text('🔙 Orqaga', 'menu:auto');
}

export function getHistoryFilterKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Bugun', 'hist:today').text('📅 Kecha', 'hist:yesterday').row()
    .text('📅 Hafta', 'hist:week').text('📅 Oy', 'hist:month').row()
    .text('📚 Barcha testlar', 'hist:all');
}

export function getChannelQuizKeyboard(testId: number): InlineKeyboard {
  // Clean, modern, elegant choice buttons
  return new InlineKeyboard()
    .text('🔹 A', `ans:${testId}:0`).text('🔹 B', `ans:${testId}:1`).row()
    .text('🔹 C', `ans:${testId}:2`).text('🔹 D', `ans:${testId}:3`);
}
