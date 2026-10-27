"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repository = exports.Repository = void 0;
const db_1 = require("./db");
class Repository {
    // --- Channel Management ---
    async getAllChannels() {
        return await db_1.prisma.channel.findMany({
            orderBy: { id: 'asc' },
        });
    }
    async getActiveChannels() {
        return await db_1.prisma.channel.findMany({
            where: { isActive: true },
            orderBy: { id: 'asc' },
        });
    }
    async getChannelById(id) {
        return await db_1.prisma.channel.findUnique({ where: { id } });
    }
    async getChannelByUsername(channelId) {
        return await db_1.prisma.channel.findUnique({ where: { channelId } });
    }
    async addChannel(channelId, title = '') {
        return await db_1.prisma.channel.upsert({
            where: { channelId },
            update: { title, isActive: true },
            create: {
                channelId,
                title: title || channelId,
                isActive: true,
            },
        });
    }
    async toggleChannelActive(id) {
        const channel = await db_1.prisma.channel.findUnique({ where: { id } });
        if (!channel)
            return null;
        return await db_1.prisma.channel.update({
            where: { id },
            data: { isActive: !channel.isActive },
        });
    }
    async deleteChannel(id) {
        return await db_1.prisma.channel.delete({ where: { id } });
    }
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
        const [todayAuto, todayManual, weekTotal, publishedCount, rejectedCount, topicCounts, statsGrouped, totalChannels, activeChannels,] = await Promise.all([
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
            db_1.prisma.channel.count(),
            db_1.prisma.channel.count({ where: { isActive: true } }),
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
            totalChannels,
            activeChannels,
        };
    }
    // --- Student Management & Monitoring ---
    async upsertStudent(telegramId, fullName, username) {
        return await db_1.prisma.student.upsert({
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
    async registerStudent(telegramId, fullName, phone, grade) {
        return await db_1.prisma.student.upsert({
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
    async getStudentByTelegramId(telegramId) {
        return await db_1.prisma.student.findUnique({
            where: { telegramId },
            include: {
                submissions: true,
            },
        });
    }
    async getStudentById(id) {
        return await db_1.prisma.student.findUnique({
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
    async getAllStudents(onlyActive = true) {
        return await db_1.prisma.student.findMany({
            where: onlyActive ? { isActive: true } : {},
            orderBy: { createdAt: 'asc' },
            include: {
                submissions: true,
            },
        });
    }
    async toggleStudentActive(id) {
        const student = await db_1.prisma.student.findUnique({ where: { id } });
        if (!student)
            return null;
        return await db_1.prisma.student.update({
            where: { id },
            data: { isActive: !student.isActive },
        });
    }
    async deleteStudent(id) {
        return await db_1.prisma.student.delete({ where: { id } });
    }
    // --- Submission Tracking ---
    async recordSubmission(testId, studentId, selectedOption, isCorrect) {
        // Check if already submitted
        const existing = await db_1.prisma.submission.findUnique({
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
        const created = await db_1.prisma.submission.create({
            data: {
                testId,
                studentId,
                selectedOption,
                isCorrect,
            },
        });
        return { alreadySubmitted: false, submission: created };
    }
    async getSubmission(testId, studentId) {
        return await db_1.prisma.submission.findUnique({
            where: {
                testId_studentId: {
                    testId,
                    studentId,
                },
            },
        });
    }
    async getTestMonitoringData(testId) {
        const test = await db_1.prisma.test.findUnique({
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
        if (!test)
            return null;
        const allStudents = await db_1.prisma.student.findMany({
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
        const participationRate = allStudents.length > 0 ? ((test.submissions.length / allStudents.length) * 100).toFixed(1) : '0';
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
    async getLeaderboard(limit = 20) {
        const students = await db_1.prisma.student.findMany({
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
    async getStudentStats(studentId) {
        const student = await db_1.prisma.student.findUnique({
            where: { id: studentId },
            include: {
                submissions: {
                    include: { test: true },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!student)
            return null;
        const totalTestsCount = await db_1.prisma.test.count({ where: { status: 'published' } });
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
    async getUnsolvedTestsForStudent(studentId, limit = 5) {
        const student = await db_1.prisma.student.findUnique({
            where: { id: studentId },
            include: { submissions: { select: { testId: true } } },
        });
        if (!student)
            return [];
        const solvedTestIds = student.submissions.map((s) => s.testId);
        return await db_1.prisma.test.findMany({
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
            db_1.prisma.submission.findMany({
                where: { createdAt: { gte: todayStart } },
                include: { student: true, test: true },
            }),
            db_1.prisma.test.count({
                where: { createdAt: { gte: todayStart }, status: 'published' },
            }),
            db_1.prisma.student.count({
                where: { isActive: true },
            }),
        ]);
        const studentMap = new Map();
        for (const sub of todaySubmissions) {
            if (!sub.student.isActive)
                continue;
            const stId = sub.student.id;
            if (!studentMap.has(stId)) {
                studentMap.set(stId, {
                    student: sub.student,
                    totalSubmitted: 0,
                    correctCount: 0,
                });
            }
            const item = studentMap.get(stId);
            item.totalSubmitted++;
            if (sub.isCorrect)
                item.correctCount++;
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
exports.Repository = Repository;
exports.repository = new Repository();
