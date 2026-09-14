import { prisma } from './db';
import { logger } from '../utils/logger';

export interface CreateTestInput {
  topic: string;
  question: string;
  questionHash: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: number;
  explanation: string;
  legalSource: string;
  sourceUrl?: string;
  imagePath?: string;
  isAuto?: boolean;
  status?: string;
}

export class Repository {
  // --- Test CRUD ---
  async createTest(data: CreateTestInput) {
    return await prisma.test.create({
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

  async updateTestStatus(id: number, status: string, telegramMessageId?: number, telegramPollId?: string) {
    return await prisma.test.update({
      where: { id },
      data: {
        status,
        telegramMessageId: telegramMessageId ?? undefined,
        telegramPollId: telegramPollId ?? undefined,
        postedAt: new Date(),
      },
    });
  }

  async getTestById(id: number) {
    return await prisma.test.findUnique({ where: { id } });
  }

  async getTestByHash(questionHash: string) {
    return await prisma.test.findUnique({ where: { questionHash } });
  }

  async getAllQuestions(limit: number = 300) {
    const tests = await prisma.test.findMany({
      take: limit,
      orderBy: { id: 'desc' },
      select: { question: true },
    });
    return tests.map((t) => t.question);
  }

  async getTopicCounts(): Promise<Record<string, number>> {
    const grouped = await prisma.test.groupBy({
      by: ['topic'],
      _count: { _all: true },
    });

    const result: Record<string, number> = {};
    for (const item of grouped) {
      result[item.topic] = item._count._all;
    }
    return result;
  }

  async getRecentTests(filterType: string = 'all', topicFilter?: string, limit: number = 10, offset: number = 0) {
    const where: any = {};
    const now = new Date();

    if (filterType === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.createdAt = { gte: todayStart };
    } else if (filterType === 'yesterday') {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.createdAt = { gte: yesterdayStart, lt: todayStart };
    } else if (filterType === 'week') {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: weekStart };
    } else if (filterType === 'month') {
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: monthStart };
    }

    if (topicFilter) {
      where.topic = topicFilter;
    }

    const [items, total] = await Promise.all([
      prisma.test.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.test.count({ where }),
    ]);

    return { items, total };
  }

  // --- Settings ---
  async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting ? setting.value : defaultValue;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  // --- Stats ---
  async recordStat(metricName: string, value: number = 1): Promise<void> {
    await prisma.stat.create({
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

    const [
      todayAuto,
      todayManual,
      weekTotal,
      publishedCount,
      rejectedCount,
      topicCounts,
      statsGrouped,
    ] = await Promise.all([
      prisma.test.count({ where: { createdAt: { gte: todayStart }, isAuto: true } }),
      prisma.test.count({ where: { createdAt: { gte: todayStart }, isAuto: false } }),
      prisma.test.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.test.count({ where: { status: 'published' } }),
      prisma.test.count({ where: { status: 'rejected' } }),
      this.getTopicCounts(),
      prisma.stat.groupBy({
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

    const statMap: Record<string, number> = {};
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

export const repository = new Repository();
