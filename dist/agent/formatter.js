"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatter = exports.Formatter = exports.MOTIVATIONAL_QUOTES = void 0;
exports.getRandomMotivationalQuote = getRandomMotivationalQuote;
const topicSelector_1 = require("./topicSelector");
exports.MOTIVATIONAL_QUOTES = [
    "«Bilim — eng qudratli qurol.»",
    "«Qonunni bilish — o‘z huquqingni himoya qilishdir.»",
    "«Kichik qadamlar katta g‘alabalarga olib boradi.»",
    "«O‘rganishdan hech qachon to‘xtamang!»",
    "«Adolat — jamiyatning eng oliy poydevoridir.»",
    "«Har kuni 1% o‘sish — yillik ulkan natijadir.»",
    "«Intizom — maqsad va natija orasidagi ko‘prikdir.»",
    "«Kuch bilimda, bilim esa tinimsiz izlanishda!»",
    "«Bugungi mehnatingiz — ertangi muvaffaqiyatingiz.»",
    "«O‘z ustingda ishlash — hayotingdagi eng yaxshi sarmoyadir.»",
    "«Haqiqiy bilim egasi doimo yuksaklikda bo‘ladi.»",
    "«Qat‘iyat bilan boshlangan harakat doim g‘alaba bilan tugaydi.»",
];
function getRandomMotivationalQuote() {
    const idx = Math.floor(Math.random() * exports.MOTIVATIONAL_QUOTES.length);
    return exports.MOTIVATIONAL_QUOTES[idx];
}
class Formatter {
    formatPostText(test, channelPromo) {
        const icon = topicSelector_1.TOPIC_ICONS[test.topic || ''] || '⚖️';
        const testIdStr = test.id ? ` #${test.id}` : '';
        const channelTag = channelPromo ? channelPromo : '@Huquq_study';
        const quote = getRandomMotivationalQuote();
        return (`<b>${icon} HUQUQIY TEST${testIdStr}</b>\n\n` +
            `📌 <b>Mavzu:</b> ${test.topic}\n\n` +
            `❓ <b>SAVOL:</b>\n${test.question}\n\n` +
            `🅰️ <b>A)</b> ${test.optionA}\n` +
            `🅱️ <b>B)</b> ${test.optionB}\n` +
            `🆎 <b>C)</b> ${test.optionC}\n` +
            `🆓 <b>D)</b> ${test.optionD}\n\n` +
            `👇 <i>Javobingizni pastdagi [ A ] [ B ] [ C ] [ D ] tugmalarini bosib tekshiring!</i>\n\n` +
            `📢 <b>Kanal:</b> ${channelTag}\n` +
            `💡 <i>${quote}</i>`);
    }
    formatPreviewText(test, channelPromo) {
        const letters = ['A', 'B', 'C', 'D'];
        const correctLetter = letters[test.correctAnswer ?? 0] || 'A';
        const channelTag = channelPromo ? channelPromo : '@Huquq_study';
        const quote = getRandomMotivationalQuote();
        return (`🧠 <b>HUQUQIY TEST (PREVIEW)</b>\n\n` +
            `📌 <b>Mavzu:</b> ${test.topic}\n\n` +
            `❓ <b>Savol:</b>\n${test.question}\n\n` +
            `🅰️ A) ${test.optionA}\n` +
            `🅱️ B) ${test.optionB}\n` +
            `🆎 C) ${test.optionC}\n` +
            `🆓 D) ${test.optionD}\n\n` +
            `✅ <b>To‘g‘ri javob:</b> ${correctLetter}\n` +
            `📚 <b>Izoh:</b> ${test.explanation}\n` +
            `⚖️ <b>Manba:</b> ${test.legalSource}\n\n` +
            `📢 ${channelTag}\n` +
            `💡 <i>${quote}</i>`);
    }
}
exports.Formatter = Formatter;
exports.formatter = new Formatter();
