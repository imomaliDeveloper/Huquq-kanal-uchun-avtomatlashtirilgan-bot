"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repository = exports.Repository = void 0;
const db_1 = require("./db");
class Repository {
    // --- Test CRUD ---
    async createTest(data) {
        return await db_1.prisma.test.create({
            data: {
                topic: data.topic,
                question: data.question,
                questionHash: data.questionHash,
                optionA: data.optionA,
                optionB: data.optionB,
                optionC: data.optionC,
                optionD: data.optionD,
                correctAnswer: data.correctAnswer,
                explanation: data.explanation,
                legalSource: data.legalSource,
                sourceUrl: data.sourceUrl || '',
                imagePath: data.imagePath || '',
                isAuto: data.isAuto ?? true,
                status: data.status || 'published',
                postedAt: new Date(),
            },
        });
    }
    async updateTestStatus(id, status, telegramMessageId, telegramPollId) {
        return await db_1.prisma.test.update({
            where: { id },
            data: {
                status,
                telegramMessageId: telegramMessageId ?? undefined,
                telegramPollId: telegramPollId ?? undefined,
                postedAt: new Date(),
            },
        });
    }
    async getTestById(id) {
        return await db_1.prisma.test.findUnique({ where: { id } });
    }
    async getTestByHash(questionHash) {
        return await db_1.prisma.test.findUnique({ where: { questionHash } });
    }
    async getAllQuestions(limit = 300) {
        const tests = await db_1.prisma.test.findMany({
            take: limit,
            orderBy: { id: 'desc' },
            select: { question: true },
        });
        return tests.map((t) => t.question);
    }
    async getTopicCounts() {
        const grouped = await db_1.prisma.test.groupBy({
            by: ['topic'],
            _count: { _all: true },
        });
        const result = {};
        for (const item of grouped) {
            result[item.topic] = item._count._all;
        }
        return result;
    }
    async getRecentTests(filterType = 'all', topicFilter, limit = 10, offset = 0) {
        const where = {};
        const now = new Date();
        if (filterType === 'today') {
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            where.createdAt = { gte: todayStart };
        }
        else if (filterType === 'yesterday') {
            const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            where.createdAt = { gte: yesterdayStart, lt: todayStart };
        }
        else if (filterType === 'week') {
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            where.createdAt = { gte: weekStart };
        }
        else if (filterType === 'month') {
            const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            where.createdAt = { gte: monthStart };
        }
        if (topicFilter) {
            where.topic = topicFilter;
        }
        const [items, total] = await Promise.all([
            db_1.prisma.test.findMany({
                where,
                orderBy: { id: 'desc' },
                take: limit,
                skip: offset,
            }),
            db_1.prisma.test.count({ where }),
        ]);
        return { items, total };
    }
    // --- Settings ---
    async getSetting(key, defaultValue = '') {
        const setting = await db_1.prisma.setting.findUnique({ where: { key } });
        return setting ? setting.value : defaultValue;
    }
    async setSetting(key, value) {
        await db_1.prisma.setting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) },
        });
    }
    // --- Stats ---
    async recordStat(metricName, value = 1) {
        await db_1.prisma.stat.create({
            data: {
                metricName,
                metricValue: value,
            },
        });
    }
    async getStatistics() {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [todayAuto, todayManual, weekTotal, publishedCount, rejectedCount, topicCounts, statsGrouped,] = await Promise.all([
            db_1.prisma.test.count({ where: { createdAt: { gte: todayStart }, isAuto: true } }),
            db_1.prisma.test.count({ where: { createdAt: { gte: todayStart }, isAuto: false } }),
            db_1.prisma.test.count({ where: { createdAt: { gte: weekStart } } }),
            db_1.prisma.test.count({ where: { status: 'published' } }),
            db_1.prisma.test.count({ where: { status: 'rejected' } }),
            this.getTopicCounts(),
            db_1.prisma.stat.groupBy({
                by: ['metricName'],
                _sum: { metricValue: true },
            }),
        ]);
        let mostUsedTopic = 'N/A';
        let maxCount = 0;
        for (const [topic, count] of Object.entries(topicCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostUsedTopic = topic;
            }
        }
        const statMap = {};
        for (const s of statsGrouped) {
            statMap[s.metricName] = s._sum.metricValue || 0;
        }
        return {
            todayAutoCount: todayAuto,
            todayManualCount: todayManual,
            todayTotalCount: todayAuto + todayManual,
            weekTotalCount: weekTotal,
            totalCount: publishedCount + rejectedCount,
            publishedCount,
            rejectedCount,
            mostUsedTopic,
            topicDistribution: topicCounts,
            aiGenerationCount: statMap['ai_generation'] || 0,
            imageGenerationCount: statMap['image_generation'] || 0,
            duplicatePreventedCount: statMap['duplicate_prevented'] || 0,
        };
    }
}
exports.Repository = Repository;
exports.repository = new Repository();
