import { repository } from '../database/schema';
import { logger } from '../utils/logger';

export const LEGAL_TOPICS: string[] = [
  'O‘zbekiston Respublikasi Konstitutsiyasi',
  'Jinoyat huquqi',
  "Ma'muriy huquq",
  'Fuqarolik huquqi',
  'Mehnat huquqi',
  'Oila huquqi',
  'Soliq huquqi',
  'Saylov huquqi',
  'Inson huquqlari',
  'Sud-huquq tizimi',
  "Iste'molchilar huquqlari",
  'Yo‘l harakati bilan bog‘liq huquqiy masalalar',
];

export const TOPIC_ICONS: Record<string, string> = {
  'O‘zbekiston Respublikasi Konstitutsiyasi': '⚖️',
  'Jinoyat huquqi': '🚔',
  "Ma'muriy huquq": '📋',
  'Fuqarolik huquqi': '🏠',
  'Mehnat huquqi': '👷',
  'Oila huquqi': '👨‍👩‍👧',
  'Soliq huquqi': '💰',
  'Saylov huquqi': '🗳',
  'Inson huquqlari': '👤',
  'Sud-huquq tizimi': '🏛',
  "Iste'molchilar huquqlari": '🛍',
  'Yo‘l harakati bilan bog‘liq huquqiy masalalar': '🚗',
};

export class TopicSelector {
  async selectTopic(requestedTopic?: string): Promise<string> {
    if (requestedTopic && LEGAL_TOPICS.includes(requestedTopic)) {
      logger.info(`Using requested topic: '${requestedTopic}'`);
      return requestedTopic;
    }

    const counts = await repository.getTopicCounts();
    let minCount = Infinity;
    let candidateTopics: string[] = [];

    for (const topic of LEGAL_TOPICS) {
      const cnt = counts[topic] || 0;
      if (cnt < minCount) {
        minCount = cnt;
        candidateTopics = [topic];
      } else if (cnt === minCount) {
        candidateTopics.push(topic);
      }
    }

    const selected = candidateTopics[Math.floor(Math.random() * candidateTopics.length)];
    logger.info(`Balanced topic selected: '${selected}' (Count: ${counts[selected] || 0})`);
    return selected;
  }
}

export const topicSelector = new TopicSelector();
