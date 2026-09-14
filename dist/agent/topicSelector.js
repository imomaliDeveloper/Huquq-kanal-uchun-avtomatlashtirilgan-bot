"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topicSelector = exports.TopicSelector = exports.TOPIC_ICONS = exports.LEGAL_TOPICS = void 0;
const schema_1 = require("../database/schema");
const logger_1 = require("../utils/logger");
exports.LEGAL_TOPICS = [
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
exports.TOPIC_ICONS = {
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
class TopicSelector {
    async selectTopic(requestedTopic) {
        if (requestedTopic && exports.LEGAL_TOPICS.includes(requestedTopic)) {
            logger_1.logger.info(`Using requested topic: '${requestedTopic}'`);
            return requestedTopic;
        }
        const counts = await schema_1.repository.getTopicCounts();
        let minCount = Infinity;
        let candidateTopics = [];
        for (const topic of exports.LEGAL_TOPICS) {
            const cnt = counts[topic] || 0;
            if (cnt < minCount) {
                minCount = cnt;
                candidateTopics = [topic];
            }
            else if (cnt === minCount) {
                candidateTopics.push(topic);
            }
        }
        const selected = candidateTopics[Math.floor(Math.random() * candidateTopics.length)];
        logger_1.logger.info(`Balanced topic selected: '${selected}' (Count: ${counts[selected] || 0})`);
        return selected;
    }
}
exports.TopicSelector = TopicSelector;
exports.topicSelector = new TopicSelector();
