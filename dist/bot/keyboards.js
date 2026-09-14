"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMainAdminKeyboard = getMainAdminKeyboard;
exports.getTopicPickerKeyboard = getTopicPickerKeyboard;
exports.getPreviewKeyboard = getPreviewKeyboard;
exports.getAutoPostKeyboard = getAutoPostKeyboard;
exports.getIntervalPickerKeyboard = getIntervalPickerKeyboard;
exports.getHistoryFilterKeyboard = getHistoryFilterKeyboard;
exports.getChannelQuizKeyboard = getChannelQuizKeyboard;
const grammy_1 = require("grammy");
const topicSelector_1 = require("../agent/topicSelector");
function getMainAdminKeyboard() {
    return new grammy_1.Keyboard()
        .text('➕ YANGI TEST').text('🚀 HOZIR JOYLASH').row()
        .text('⏰ AVTO POST').text('📚 MAVZULAR').row()
        .text('📝 TESTLAR').text('📊 STATISTIKA').row()
        .text('⚙️ SOZLAMALAR')
        .resized()
        .persistent();
}
function getTopicPickerKeyboard() {
    const kb = new grammy_1.InlineKeyboard();
    for (const topic of topicSelector_1.LEGAL_TOPICS) {
        const icon = topicSelector_1.TOPIC_ICONS[topic] || '⚖️';
        kb.text(`${icon} ${topic}`, `topic:${topic}`).row();
    }
    kb.text('🎲 Tasodifiy mavzu', 'topic:random').row();
    kb.text('❌ Bekor qilish', 'action:cancel');
    return kb;
}
function getPreviewKeyboard(testId) {
    return new grammy_1.InlineKeyboard()
        .text('🚀 KANALGA JOYLASH', `publish:${testId}`).row()
        .text('🔄 QAYTA YARATISH', `regen:${testId}`).row()
        .text('❌ BEKOR QILISH', `reject:${testId}`);
}
function getAutoPostKeyboard(isEnabled, quietEnabled, peakEnabled) {
    const toggleBtnText = isEnabled ? '🔴 AVTO-POSTNI O‘CHIRISH' : '🟢 AVTO-POSTNI YOQISH';
    const toggleData = isEnabled ? 'auto_toggle:off' : 'auto_toggle:on';
    const quietText = quietEnabled ? '🌙 Tungi Jimlik (23:00 - 07:00): YOQILGAN' : '🌙 Tungi Jimlik: O‘CHIRILGAN';
    const quietData = quietEnabled ? 'quiet_toggle:off' : 'quiet_toggle:on';
    const peakText = peakEnabled ? '⭐ Peak Rejimi (09,13,18,21): YOQILGAN' : '⭐ Peak Rejimi: O‘CHIRILGAN';
    const peakData = peakEnabled ? 'peak_toggle:off' : 'peak_toggle:on';
    return new grammy_1.InlineKeyboard()
        .text(toggleBtnText, toggleData).row()
        .text(quietText, quietData).row()
        .text(peakText, peakData).row()
        .text('⏱ INTERVALNI O‘ZGARTIRISH', 'auto_change_interval').row()
        .text('🔙 Bosh menyu', 'admin_menu');
}
function getIntervalPickerKeyboard() {
    return new grammy_1.InlineKeyboard()
        .text('30 daqiqa', 'set_int:0.5').text('1 soat', 'set_int:1.0').row()
        .text('2 soat', 'set_int:2.0').text('3 soat', 'set_int:3.0').row()
        .text('6 soat', 'set_int:6.0').text('12 soat', 'set_int:12.0').row()
        .text('24 soat', 'set_int:24.0').row()
        .text('🔙 Orqaga', 'menu:auto');
}
function getHistoryFilterKeyboard() {
    return new grammy_1.InlineKeyboard()
        .text('📅 Bugun', 'hist:today').text('📅 Kecha', 'hist:yesterday').row()
        .text('📅 Hafta', 'hist:week').text('📅 Oy', 'hist:month').row()
        .text('📚 Barcha testlar', 'hist:all');
}
function getChannelQuizKeyboard(testId) {
    // Clean, modern, elegant choice buttons
    return new grammy_1.InlineKeyboard()
        .text('🔹 A', `ans:${testId}:0`).text('🔹 B', `ans:${testId}:1`).row()
        .text('🔹 C', `ans:${testId}:2`).text('🔹 D', `ans:${testId}:3`);
}
