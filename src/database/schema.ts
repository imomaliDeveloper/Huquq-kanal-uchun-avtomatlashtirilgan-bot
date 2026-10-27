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
  // --- Channel Management ---
  async getAllChannels() {
    return await prisma.channel.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async getActiveChannels() {
    return await prisma.channel.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  async getChannelById(id: number) {
    return await prisma.channel.findUnique({ where: { id } });
  }

  async getChannelByUsername(channelId: string) {
    return await prisma.channel.findUnique({ where: { channelId } });
  }

  async addChannel(channelId: string, title: string = '') {
    return await prisma.channel.upsert({
      where: { channelId },
      update: { title, isActive: true },
      create: {
        channelId,
        title: title || channelId,
        isActive: true,
      },
    });
  }

  async toggleChannelActive(id: number) {
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return null;
    return await prisma.channel.update({
      where: { id },
      data: { isActive: !channel.isActive },
    });
  }

  async deleteChannel(id: number) {
    return await prisma.channel.delete({ where: { id } });
  }

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
      totalChannels,
      activeChannels,
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
      prisma.channel.count(),
      prisma.channel.count({ where: { isActive: true } }),
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
      totalChannels,
      activeChannels,
    };
  }

  // --- Student Management & Monitoring ---

  async upsertStudent(telegramId: string, fullName: string, username?: string) {
    return await prisma.student.upsert({
      where: { telegramId },
      update: {
        fullName: fullName || undefined,
        username: username || undefined,
        updatedAt: new Date(),
      },
      create: {
        telegramId,
        fullName: fullName || `User_${telegramId}`,
        username: username || '',
      },
    });
  }

  async registerStudent(telegramId: string, fullName: string, phone?: string, grade?: string) {
    return await prisma.student.upsert({
      where: { telegramId },
      update: {
        fullName,
        phone: phone || undefined,
        grade: grade || undefined,
        isRegistered: true,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        telegramId,
        fullName,
        phone: phone || '',
        grade: grade || '',
        isRegistered: true,
        isActive: true,
      },
    });
  }

  async getStudentByTelegramId(telegramId: string) {
    return await prisma.student.findUnique({
      where: { telegramId },
      include: {
        submissions: true,
      },
    });
  }

  async getStudentById(id: number) {
    return await prisma.student.findUnique({
      where: { id },
      include: {
        submissions: {
          include: {
            test: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getAllStudents(onlyActive: boolean = true) {
    return await prisma.student.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { createdAt: 'asc' },
      include: {
        submissions: true,
      },
    });
  }

  async toggleStudentActive(id: number) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return null;
    return await prisma.student.update({
      where: { id },
      data: { isActive: !student.isActive },
    });
  }

  async deleteStudent(id: number) {
    return await prisma.student.delete({ where: { id } });
  }

  // --- Submission Tracking ---

  async recordSubmission(testId: number, studentId: number, selectedOption: number, isCorrect: boolean) {
    // Check if already submitted
    const existing = await prisma.submission.findUnique({
      where: {
        testId_studentId: {
          testId,
          studentId,
        },
      },
    });

    if (existing) {
      return { alreadySubmitted: true, submission: existing };
    }

    const created = await prisma.submission.create({
      data: {
        testId,
        studentId,
        selectedOption,
        isCorrect,
      },
    });

    return { alreadySubmitted: false, submission: created };
  }

  async getSubmission(testId: number, studentId: number) {
    return await prisma.submission.findUnique({
      where: {
        testId_studentId: {
          testId,
          studentId,
        },
      },
    });
  }

  async getTestMonitoringData(testId: number) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        submissions: {
          include: {
            student: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!test) return null;

    const allStudents = await prisma.student.findMany({
      where: { isActive: true },
      orderBy: { fullName: 'asc' },
    });

    const submittedStudentIds = new Set(test.submissions.map((s) => s.studentId));

    const solvedStudents = test.submissions.map((sub) => ({
      submissionId: sub.id,
      studentId: sub.student.id,
      fullName: sub.student.fullName,
      username: sub.student.username,
      grade: sub.student.grade,
      selectedOption: sub.selectedOption,
      isCorrect: sub.isCorrect,
      submittedAt: sub.createdAt,
    }));

    const unsolvedStudents = allStudents.filter((st) => !submittedStudentIds.has(st.id));

    const correctCount = test.submissions.filter((s) => s.isCorrect).length;
    const incorrectCount = test.submissions.length - correctCount;
    const participationRate =
      allStudents.length > 0 ? ((test.submissions.length / allStudents.length) * 100).toFixed(1) : '0';

    return {
      test,
      totalStudents: allStudents.length,
      solvedCount: solvedStudents.length,
      unsolvedCount: unsolvedStudents.length,
      correctCount,
      incorrectCount,
      participationRate,
      solvedStudents,
      unsolvedStudents,
    };
  }

  async getLeaderboard(limit: number = 20) {
    const students = await prisma.student.findMany({
      where: { isActive: true },
      include: {
        submissions: true,
      },
    });

    const scored = students.map((s) => {
      const totalSubmitted = s.submissions.length;
      const totalCorrect = s.submissions.filter((sub) => sub.isCorrect).length;
      const accuracy = totalSubmitted > 0 ? Math.round((totalCorrect / totalSubmitted) * 100) : 0;
      return {
        id: s.id,
        telegramId: s.telegramId,
        fullName: s.fullName,
        username: s.username,
        grade: s.grade,
        totalSubmitted,
        totalCorrect,
        accuracy,
      };
    });

    // Sort by correct answers desc, then accuracy desc
    scored.sort((a, b) => b.totalCorrect - a.totalCorrect || b.accuracy - a.accuracy);
    return scored.slice(0, limit);
  }

  async getStudentStats(studentId: number) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        submissions: {
          include: { test: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) return null;

    const totalTestsCount = await prisma.test.count({ where: { status: 'published' } });
    const solvedCount = student.submissions.length;
    const correctCount = student.submissions.filter((s) => s.isCorrect).length;
    const incorrectCount = solvedCount - correctCount;
    const unsolvedCount = Math.max(0, totalTestsCount - solvedCount);
    const accuracy = solvedCount > 0 ? Math.round((correctCount / solvedCount) * 100) : 0;

    return {
      student,
      totalTestsCount,
      solvedCount,
      correctCount,
      incorrectCount,
      unsolvedCount,
      accuracy,
      recentSubmissions: student.submissions.slice(0, 10),
    };
  }

  async getUnsolvedTestsForStudent(studentId: number, limit: number = 5) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { submissions: { select: { testId: true } } },
    });

    if (!student) return [];

    const solvedTestIds = student.submissions.map((s) => s.testId);

    return await prisma.test.findMany({
      where: {
        status: 'published',
        id: { notIn: solvedTestIds },
      },
      orderBy: { id: 'desc' },
      take: limit,
    });
  }

  async getDailyStudentReport() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const [todaySubmissions, todayPublishedTests, totalActiveStudents] = await Promise.all([
      prisma.submission.findMany({
        where: { createdAt: { gte: todayStart } },
        include: { student: true, test: true },
      }),
      prisma.test.count({
        where: { createdAt: { gte: todayStart }, status: 'published' },
      }),
      prisma.student.count({
        where: { isActive: true },
      }),
    ]);

    const studentMap = new Map<number, {
      student: any;
      totalSubmitted: number;
      correctCount: number;
    }>();

    for (const sub of todaySubmissions) {
      if (!sub.student.isActive) continue;
      const stId = sub.student.id;
      if (!studentMap.has(stId)) {
        studentMap.set(stId, {
          student: sub.student,
          totalSubmitted: 0,
          correctCount: 0,
        });
      }
      const item = studentMap.get(stId)!;
      item.totalSubmitted++;
      if (sub.isCorrect) item.correctCount++;
    }

    const leaderboard = Array.from(studentMap.values()).map((item) => {
      const accuracy = item.totalSubmitted > 0 ? Math.round((item.correctCount / item.totalSubmitted) * 100) : 0;
      return {
        ...item,
        accuracy,
      };
    });

    // Sort: most correct desc, then accuracy desc
    leaderboard.sort((a, b) => b.correctCount - a.correctCount || b.accuracy - a.accuracy);

    const participatingStudentsCount = studentMap.size;
    const totalAnswers = todaySubmissions.length;
    const totalCorrectAnswers = todaySubmissions.filter((s) => s.isCorrect).length;
    const averageAccuracy = totalAnswers > 0 ? Math.round((totalCorrectAnswers / totalAnswers) * 100) : 0;
    const participationRate = totalActiveStudents > 0 ? Math.round((participatingStudentsCount / totalActiveStudents) * 100) : 0;

    return {
      date: now,
      todayPublishedTests,
      totalActiveStudents,
      participatingStudentsCount,
      totalAnswers,
      totalCorrectAnswers,
      averageAccuracy,
      participationRate,
      topStudents: leaderboard.slice(0, 10),
    };
  }
}

export const repository = new Repository();
