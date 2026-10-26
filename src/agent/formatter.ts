import { Test } from '@prisma/client';
import { TOPIC_ICONS } from './topicSelector';

export class Formatter {
  formatPostText(test: Partial<Test>, channelPromo?: string): string {
    const icon = TOPIC_ICONS[test.topic || ''] || '⚖️';
    const testIdStr = test.id ? ` #${test.id}` : '';
    const channelTag = channelPromo ? channelPromo : '@Huquq_study';

    return (
      `<b>${icon} HUQUQIY TEST${testIdStr}</b>\n\n` +
      `📌 <b>Mavzu:</b> ${test.topic}\n\n` +
      `❓ <b>SAVOL:</b>\n${test.question}\n\n` +
      `🅰️ <b>A)</b> ${test.optionA}\n` +
      `🅱️ <b>B)</b> ${test.optionB}\n` +
      `🆎 <b>C)</b> ${test.optionC}\n` +
      `🆓 <b>D)</b> ${test.optionD}\n\n` +
      `👇 <i>Javobingizni pastdagi [ A ] [ B ] [ C ] [ D ] tugmalarini bosib tekshiring!</i>\n\n` +
      `📢 <b>Kanal:</b> ${channelTag}\n` +
      `🤖 <b>Bot:</b> @Huquqchi_bot`
    );
  }

  formatPreviewText(test: Partial<Test>): string {
    const letters = ['A', 'B', 'C', 'D'];
    const correctLetter = letters[test.correctAnswer ?? 0] || 'A';

    return (
      `🧠 <b>HUQUQIY TEST (PREVIEW)</b>\n\n` +
      `📌 <b>Mavzu:</b> ${test.topic}\n\n` +
      `❓ <b>Savol:</b>\n${test.question}\n\n` +
      `🅰️ A) ${test.optionA}\n` +
      `🅱️ B) ${test.optionB}\n` +
      `🆎 C) ${test.optionC}\n` +
      `🆓 D) ${test.optionD}\n\n` +
      `✅ <b>To‘g‘ri javob:</b> ${correctLetter}\n` +
      `📚 <b>Izoh:</b> ${test.explanation}\n` +
      `⚖️ <b>Manba:</b> ${test.legalSource}\n\n` +
      `📢 @Huquq_study | 🤖 @Huquqchi_bot`
    );
  }
}

export const formatter = new Formatter();
