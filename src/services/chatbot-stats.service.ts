/**
 * Chatbot Statistics Service
 * 
 * Provides read-only functions to fetch and analyze chatbot interaction data.
 * Supports cohort filtering to match the existing dashboard behavior.
 */

import { prisma } from "./prisma";

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of questions
 */
function levenshteinDistance(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[s2.length][s1.length];
}

/**
 * Calculate similarity percentage between two strings
 * Returns a value between 0 and 100
 */
function calculateSimilarity(str1: string, str2: string): number {
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    if (maxLength === 0) return 100;

    const similarity = ((maxLength - distance) / maxLength) * 100;
    return Math.round(similarity);
}

/**
 * Check if a question is similar to a specific prompt
 */
function isSimilarQuestion(question: string, prompt: string): boolean {
    const SIMILARITY_THRESHOLD = 70;
    return calculateSimilarity(question, prompt) >= SIMILARITY_THRESHOLD;
}

/**
 * Check if a question matches any predefined prompts using fuzzy matching
 * Returns true if similarity is >= 70%
 */
function matchesAnyPrompt(question: string, prompts: string[]): boolean {
    const SIMILARITY_THRESHOLD = 70; // 70% similarity required

    for (const prompt of prompts) {
        const similarity = calculateSimilarity(question, prompt);
        if (similarity >= SIMILARITY_THRESHOLD) {
            return true;
        }
    }

    return false;
}

interface ChatbotSessionStats {
    moduleNo: number;
    moduleName: string;
    topics: {
        topicId: string;
        topicName: string;
        sessionCount: number;
        messageCount: number;
        lastMessageAt: Date | null;
    }[];
}

interface QuestionTypeAnalysis {
    totalQuestions: number;
    predefinedQuestions: number;
    customQuestions: number;
    predefinedPercentage: number;
    customPercentage: number;
}

interface DetailedQuestionAnalysis extends QuestionTypeAnalysis {
    breakdown: {
        topicId: string;
        topicName: string;
        moduleName: string;
        totalQuestions: number;
        predefinedCount: number;
        customCount: number;
    }[];
}

/**
 * Get list of learner user IDs based on cohort filter
 */
async function getTargetLearnerIds(
    courseId: string,
    cohortId?: string,
    learnerId?: string
): Promise<string[]> {
    // If specific learner requested, return only that learner
    if (learnerId) {
        return [learnerId];
    }

    // If cohort filter is applied, get learners from cohort
    if (cohortId) {
        const members = await prisma.cohortMember.findMany({
            where: { cohortId },
            select: { userId: true }
        });

        // Filter out null userIds
        return members
            .map(m => m.userId)
            .filter((id): id is string => id !== null);
    }

    // Otherwise, get all enrolled learners
    const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        select: { userId: true }
    });

    return enrollments.map(e => e.userId);
}

/**
 * Get chatbot session statistics per topic/module
 * READ-ONLY operation
 */
export async function getChatbotSessionStats(
    courseId: string,
    cohortId?: string,
    learnerId?: string
): Promise<ChatbotSessionStats[]> {
    const learnerIds = await getTargetLearnerIds(courseId, cohortId, learnerId);

    if (learnerIds.length === 0) {
        return [];
    }

    // Fetch all sessions for target learners
    const sessions = await prisma.ragChatSession.findMany({
        where: {
            courseId,
            userId: { in: learnerIds }
        },
        include: {
            topic: {
                select: {
                    topicId: true,
                    topicName: true,
                    moduleNo: true,
                    moduleName: true
                }
            },
            _count: {
                select: {
                    messages: {
                        where: {
                            role: 'user' // Only count user messages
                        }
                    }
                }
            }
        }
    });

    // Group by module
    const moduleMap = new Map<number, ChatbotSessionStats>();

    sessions.forEach(session => {
        const { moduleNo, moduleName, topicId, topicName } = session.topic;

        if (!moduleMap.has(moduleNo)) {
            moduleMap.set(moduleNo, {
                moduleNo,
                moduleName,
                topics: []
            });
        }

        const module = moduleMap.get(moduleNo)!;
        let topic = module.topics.find(t => t.topicId === topicId);

        if (!topic) {
            topic = {
                topicId,
                topicName,
                sessionCount: 0,
                messageCount: 0,
                lastMessageAt: null
            };
            module.topics.push(topic);
        }

        topic.sessionCount++;
        topic.messageCount += session._count.messages;

        if (session.lastMessageAt) {
            if (!topic.lastMessageAt || session.lastMessageAt > topic.lastMessageAt) {
                topic.lastMessageAt = session.lastMessageAt;
            }
        }
    });

    // Convert to array and sort
    const result = Array.from(moduleMap.values()).sort((a, b) => a.moduleNo - b.moduleNo);

    return result;
}

/**
 * Get question type analysis (predefined vs custom)
 * READ-ONLY operation
 */
export async function getQuestionTypeAnalysis(
    courseId: string,
    cohortId?: string,
    learnerId?: string,
    topicId?: string
): Promise<DetailedQuestionAnalysis> {
    const learnerIds = await getTargetLearnerIds(courseId, cohortId, learnerId);

    if (learnerIds.length === 0) {
        return {
            totalQuestions: 0,
            predefinedQuestions: 0,
            customQuestions: 0,
            predefinedPercentage: 0,
            customPercentage: 0,
            breakdown: []
        };
    }

    // Build where clause for messages
    const messageWhere: any = {
        session: {
            courseId,
            userId: { in: learnerIds }
        },
        role: 'user' // Only analyze user questions
    };

    if (topicId) {
        messageWhere.session.topicId = topicId;
    }

    // Fetch all user messages
    const messages = await prisma.ragChatMessage.findMany({
        where: messageWhere,
        select: {
            messageId: true,
            content: true,
            session: {
                select: {
                    topicId: true,
                    topic: {
                        select: {
                            topicName: true,
                            moduleName: true
                        }
                    }
                }
            }
        }
    });

    if (messages.length === 0) {
        return {
            totalQuestions: 0,
            predefinedQuestions: 0,
            customQuestions: 0,
            predefinedPercentage: 0,
            customPercentage: 0,
            breakdown: []
        };
    }

    // Fetch predefined prompts for the course
    const promptsWhere: any = { courseId };
    if (topicId) {
        promptsWhere.topicId = topicId;
    }

    const prompts = await prisma.topicPromptSuggestion.findMany({
        where: promptsWhere,
        select: {
            suggestionId: true,
            promptText: true,
            topicId: true
        }
    });

    // Group prompts by topic for efficient lookup
    const promptsByTopic = new Map<string, string[]>();
    prompts.forEach(p => {
        if (p.topicId) {
            if (!promptsByTopic.has(p.topicId)) {
                promptsByTopic.set(p.topicId, []);
            }
            promptsByTopic.get(p.topicId)!.push(p.promptText);
        }
    });

    // Analyze each message
    let totalPredefined = 0;
    let totalCustom = 0;

    const topicBreakdown = new Map<string, {
        topicId: string;
        topicName: string;
        moduleName: string;
        predefinedCount: number;
        customCount: number;
    }>();

    messages.forEach(msg => {
        const topicId = msg.session.topicId;
        const topicPrompts = promptsByTopic.get(topicId) || [];
        const isPredefined = matchesAnyPrompt(msg.content, topicPrompts);

        if (isPredefined) {
            totalPredefined++;
        } else {
            totalCustom++;
        }

        // Update topic breakdown
        if (!topicBreakdown.has(topicId)) {
            topicBreakdown.set(topicId, {
                topicId,
                topicName: msg.session.topic.topicName,
                moduleName: msg.session.topic.moduleName,
                predefinedCount: 0,
                customCount: 0
            });
        }

        const topicStats = topicBreakdown.get(topicId)!;
        if (isPredefined) {
            topicStats.predefinedCount++;
        } else {
            topicStats.customCount++;
        }
    });

    const totalQuestions = messages.length;
    const predefinedPercentage = totalQuestions > 0
        ? Math.round((totalPredefined / totalQuestions) * 100)
        : 0;
    const customPercentage = totalQuestions > 0
        ? Math.round((totalCustom / totalQuestions) * 100)
        : 0;

    const breakdown = Array.from(topicBreakdown.values()).map(t => ({
        topicId: t.topicId,
        topicName: t.topicName,
        moduleName: t.moduleName,
        totalQuestions: t.predefinedCount + t.customCount,
        predefinedCount: t.predefinedCount,
        customCount: t.customCount
    }));

    return {
        totalQuestions,
        predefinedQuestions: totalPredefined,
        customQuestions: totalCustom,
        predefinedPercentage,
        customPercentage,
        breakdown
    };
}

/**
 * Get per-learner chatbot statistics
 * Returns individual learner stats with question type breakdown
 * READ-ONLY operation
 */
export async function getPerLearnerStats(
    courseId: string,
    cohortId?: string,
    learnerId?: string
): Promise<Array<{
    userId: string;
    userName: string;
    userEmail: string;
    totalSessions: number;
    totalQuestions: number;
    predefinedCount: number;
    customCount: number;
    predefinedPercentage: number;
    customPercentage: number;
    mostActiveModule: string | null;
    lastActivityAt: Date | null;
}>> {
    const targetLearnerIds = await getTargetLearnerIds(courseId, cohortId, learnerId);

    if (targetLearnerIds.length === 0) {
        return [];
    }

    // Get all sessions for target learners
    const sessions = await prisma.ragChatSession.findMany({
        where: {
            courseId,
            userId: { in: targetLearnerIds }
        },
        include: {
            user: {
                select: {
                    userId: true,
                    fullName: true,
                    email: true
                }
            },
            topic: {
                select: {
                    topicName: true,
                    moduleNo: true,
                    moduleName: true
                }
            },
            messages: {
                where: { role: 'user' },
                select: {
                    messageId: true,
                    content: true,
                    createdAt: true
                }
            }
        }
    });

    // Get all prompt suggestions for fuzzy matching
    const promptSuggestions = await prisma.topicPromptSuggestion.findMany({
        where: { courseId },
        select: {
            promptText: true,
            topicId: true
        }
    });

    // Build per-learner statistics
    const learnerStatsMap = new Map<string, {
        userId: string;
        userName: string;
        userEmail: string;
        totalSessions: number;
        totalQuestions: number;
        predefinedCount: number;
        customCount: number;
        moduleActivity: Map<string, number>;
        lastActivityAt: Date | null;
    }>();

    for (const session of sessions) {
        const userId = session.userId;

        if (!learnerStatsMap.has(userId)) {
            learnerStatsMap.set(userId, {
                userId,
                userName: session.user.fullName,
                userEmail: session.user.email,
                totalSessions: 0,
                totalQuestions: 0,
                predefinedCount: 0,
                customCount: 0,
                moduleActivity: new Map(),
                lastActivityAt: null
            });
        }

        const stats = learnerStatsMap.get(userId)!;
        stats.totalSessions++;

        // Track module activity
        const moduleName = session.topic?.moduleName || 'Unknown Module';
        stats.moduleActivity.set(moduleName, (stats.moduleActivity.get(moduleName) || 0) + 1);

        // Analyze questions
        const topicPrompts = promptSuggestions.filter(p => p.topicId === session.topicId);

        for (const message of session.messages) {
            stats.totalQuestions++;

            // Update last activity
            if (!stats.lastActivityAt || message.createdAt > stats.lastActivityAt) {
                stats.lastActivityAt = message.createdAt;
            }

            // Check if question is predefined or custom
            const isPredefined = topicPrompts.some(prompt =>
                isSimilarQuestion(message.content, prompt.promptText)
            );

            if (isPredefined) {
                stats.predefinedCount++;
            } else {
                stats.customCount++;
            }
        }
    }

    // Convert to array and calculate percentages
    const result = Array.from(learnerStatsMap.values()).map(stats => {
        const predefinedPercentage = stats.totalQuestions > 0
            ? Math.round((stats.predefinedCount / stats.totalQuestions) * 100)
            : 0;
        const customPercentage = stats.totalQuestions > 0
            ? Math.round((stats.customCount / stats.totalQuestions) * 100)
            : 0;

        // Find most active module
        let mostActiveModule: string | null = null;
        let maxActivity = 0;
        for (const [moduleName, count] of stats.moduleActivity.entries()) {
            if (count > maxActivity) {
                maxActivity = count;
                mostActiveModule = moduleName;
            }
        }

        return {
            userId: stats.userId,
            userName: stats.userName,
            userEmail: stats.userEmail,
            totalSessions: stats.totalSessions,
            totalQuestions: stats.totalQuestions,
            predefinedCount: stats.predefinedCount,
            customCount: stats.customCount,
            predefinedPercentage,
            customPercentage,
            mostActiveModule,
            lastActivityAt: stats.lastActivityAt
        };
    });

    // Sort by most recent activity first
    return result.sort((a, b) => {
        const dateA = a.lastActivityAt ? a.lastActivityAt.getTime() : 0;
        const dateB = b.lastActivityAt ? b.lastActivityAt.getTime() : 0;
        return dateB - dateA;
    });
}

/**
 * Get custom questions asked by a specific learner
 * Returns only questions identified as custom (not matching predefined prompts)
 * READ-ONLY operation
 */
export async function getLearnerCustomQuestions(
    courseId: string,
    learnerId: string,
    cohortId?: string
): Promise<Array<{
    questionText: string;
    topicName: string;
    moduleName: string;
    askedAt: Date;
}>> {
    // Verify learner is in the target cohort (if specified)
    const targetLearnerIds = await getTargetLearnerIds(courseId, cohortId, learnerId);

    if (!targetLearnerIds.includes(learnerId)) {
        return [];
    }

    // Get all sessions and messages for this learner
    const sessions = await prisma.ragChatSession.findMany({
        where: {
            courseId,
            userId: learnerId
        },
        include: {
            topic: {
                select: {
                    topicId: true,
                    topicName: true,
                    moduleName: true
                }
            },
            messages: {
                where: { role: 'user' },
                select: {
                    content: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    // Get all prompt suggestions for fuzzy matching
    const promptSuggestions = await prisma.topicPromptSuggestion.findMany({
        where: { courseId },
        select: {
            promptText: true,
            topicId: true
        }
    });

    const customQuestions: Array<{
        questionText: string;
        topicName: string;
        moduleName: string;
        askedAt: Date;
    }> = [];

    for (const session of sessions) {
        const topicPrompts = promptSuggestions.filter(p => p.topicId === session.topicId);

        for (const message of session.messages) {
            // Check if question is custom (not matching any predefined prompt)
            const isPredefined = topicPrompts.some(prompt =>
                isSimilarQuestion(message.content, prompt.promptText)
            );

            if (!isPredefined) {
                customQuestions.push({
                    questionText: message.content,
                    topicName: session.topic?.topicName || 'Unknown Topic',
                    moduleName: session.topic?.moduleName || 'Unknown Module',
                    askedAt: message.createdAt
                });
            }
        }
    }

    // Sort by most recent first
    return customQuestions.sort((a, b) => b.askedAt.getTime() - a.askedAt.getTime());
}

/**
 * Get module activity overview
 * Returns modules sorted by chatbot activity with custom question percentages
 * READ-ONLY operation
 */
export async function getModuleActivityOverview(
    courseId: string,
    cohortId?: string
): Promise<Array<{
    moduleNo: number;
    moduleName: string;
    totalSessions: number;
    totalQuestions: number;
    customQuestionCount: number;
    customQuestionPercentage: number;
}>> {
    const targetLearnerIds = await getTargetLearnerIds(courseId, cohortId);

    if (targetLearnerIds.length === 0) {
        return [];
    }

    // Get all sessions for target learners
    const sessions = await prisma.ragChatSession.findMany({
        where: {
            courseId,
            userId: { in: targetLearnerIds }
        },
        include: {
            topic: {
                select: {
                    topicId: true,
                    topicName: true,
                    moduleNo: true,
                    moduleName: true
                }
            },
            messages: {
                where: { role: 'user' },
                select: {
                    content: true
                }
            }
        }
    });

    // Get all prompt suggestions for fuzzy matching
    const promptSuggestions = await prisma.topicPromptSuggestion.findMany({
        where: { courseId },
        select: {
            promptText: true,
            topicId: true
        }
    });

    // Build module statistics
    const moduleStatsMap = new Map<string, {
        moduleNo: number;
        moduleName: string;
        totalSessions: number;
        totalQuestions: number;
        customQuestionCount: number;
    }>();

    for (const session of sessions) {
        const moduleNo = session.topic?.moduleNo ?? 999;
        const moduleName = session.topic?.moduleName || 'Unknown Module';
        const moduleKey = `${moduleNo}-${moduleName}`;

        if (!moduleStatsMap.has(moduleKey)) {
            moduleStatsMap.set(moduleKey, {
                moduleNo,
                moduleName,
                totalSessions: 0,
                totalQuestions: 0,
                customQuestionCount: 0
            });
        }

        const stats = moduleStatsMap.get(moduleKey)!;
        stats.totalSessions++;

        // Analyze questions
        const topicPrompts = promptSuggestions.filter(p => p.topicId === session.topicId);

        for (const message of session.messages) {
            stats.totalQuestions++;

            // Check if question is custom
            const isPredefined = topicPrompts.some(prompt =>
                isSimilarQuestion(message.content, prompt.promptText)
            );

            if (!isPredefined) {
                stats.customQuestionCount++;
            }
        }
    }

    // Convert to array and calculate percentages
    const result = Array.from(moduleStatsMap.values()).map(stats => ({
        moduleNo: stats.moduleNo,
        moduleName: stats.moduleName,
        totalSessions: stats.totalSessions,
        totalQuestions: stats.totalQuestions,
        customQuestionCount: stats.customQuestionCount,
        customQuestionPercentage: stats.totalQuestions > 0
            ? Math.round((stats.customQuestionCount / stats.totalQuestions) * 100)
            : 0
    }));

    // Sort by total sessions (most active first)
    return result.sort((a, b) => b.totalSessions - a.totalSessions);
}
