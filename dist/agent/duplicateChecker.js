"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateChecker = exports.DuplicateChecker = void 0;
exports.computeHash = computeHash;
exports.calculateSimilarity = calculateSimilarity;
const crypto_1 = __importDefault(require("crypto"));
const schema_1 = require("../database/schema");
const logger_1 = require("../utils/logger");
function computeHash(text) {
    const normalized = text.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
    return crypto_1.default.createHash('sha256').update(normalized, 'utf8').digest('hex');
}
function calculateSimilarity(s1, s2) {
    const clean1 = s1.toLowerCase().replace(/[^\w\s]/gi, '');
    const clean2 = s2.toLowerCase().replace(/[^\w\s]/gi, '');
    const words1 = new Set(clean1.split(/\s+/));
    const words2 = new Set(clean2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    if (union.size === 0)
        return 0;
    return (intersection.size / union.size) * 100;
}
class DuplicateChecker {
    async isDuplicate(question, threshold = 80) {
        const questionHash = computeHash(question);
        // 1. Exact hash check
        const existing = await schema_1.repository.getTestByHash(questionHash);
        if (existing) {
            logger_1.logger.warn(`Exact hash duplicate detected: ${questionHash.substring(0, 8)}`);
            await schema_1.repository.recordStat('duplicate_prevented');
            return { isDup: true, reason: `Exact hash match with Test #${existing.id}` };
        }
        // 2. Similarity check
        const pastQuestions = await schema_1.repository.getAllQuestions(300);
        for (const past of pastQuestions) {
            const score = calculateSimilarity(question, past);
            if (score >= threshold) {
                logger_1.logger.warn(`Semantic duplicate detected (${score.toFixed(1)}% similarity): '${question.substring(0, 40)}...'`);
                await schema_1.repository.recordStat('duplicate_prevented');
                return { isDup: true, reason: `Semantic duplicate match (${score.toFixed(1)}%)` };
            }
        }
        return { isDup: false, reason: 'Unique question verified' };
    }
}
exports.DuplicateChecker = DuplicateChecker;
exports.duplicateChecker = new DuplicateChecker();
