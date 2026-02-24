import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

/**
 * READ-ONLY Database Query Functions for Tutor Copilot
 * 
 * CRITICAL RULES:
 * - All functions are READ-ONLY (SELECT queries only)
 * - All queries MUST filter by courseId for data isolation
 * - No INSERT, UPDATE, DELETE, or ALTER operations
 * - All functions return raw data for AI to format
 */

// ============================================================================
// LEARNER PERFORMANCE QUERIES
// ============================================================================

/**
 * Get top N learners by completion percentage in a specific cohort
 * @param courseId - Course ID (required for isolation)
 * @param cohortId - Cohort ID (optional, if not provided returns all course learners)
 * @param limit - Number of learners to return
 * @param sortOrder - 'desc' for highest first, 'asc' for lowest first
 */
export async function getTopLearnersByCohort(params: {
    courseId: string;
    cohortId?: string;
    limit: number;
    sortOrder: 'desc' | 'asc';
}) {
    const { courseId, cohortId, limit, sortOrder } = params;

    // Get total modules for the course
    const maxModule = await prisma.topic.aggregate({
        where: { courseId, moduleNo: { gt: 0 } },
        _max: { moduleNo: true },
    });
    const totalModules = maxModule._max.moduleNo || 8;

    // Get learners based on cohort or all enrollments
    let learners: Array<{ userId: string | null; fullName: string; email: string }>;

    if (cohortId) {
        const members = await prisma.cohortMember.findMany({
            where: { cohortId, cohort: { courseId } }, // Ensure cohort belongs to course
            include: { user: { select: { fullName: true } } },
        });
        learners = members.map(m => ({
            userId: m.userId,
            fullName: m.user?.fullName || m.email.split('@')[0],
            email: m.email,
        }));
    } else {
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId },
            include: { user: { select: { fullName: true, email: true } } },
        });
        learners = enrollments.map(e => ({
            userId: e.userId,
            fullName: e.user.fullName,
            email: e.user.email,
        }));
    }

    // Get progress for all learners
    const userIds = learners.map(l => l.userId).filter((id): id is string => id !== null);

    // If no userIds, return learners with 0% completion
    if (userIds.length === 0) {
        return learners.map(learner => ({
            name: learner.fullName,
            email: learner.email,
            completedModules: 0,
            totalModules,
            percent: 0,
        })).slice(0, limit);
    }

    const progressRows = await prisma.$queryRaw<
        { user_id: string; module_no: number; quiz_passed: boolean }[]
    >(Prisma.sql`
    SELECT user_id::text as user_id, module_no, quiz_passed
    FROM module_progress
    WHERE course_id::text = ${courseId}
    AND user_id::text IN (${Prisma.join(userIds)})
  `);

    // Calculate completion for each learner
    const progressByUser = new Map<string, Set<number>>();
    progressRows.forEach(row => {
        if (!row.quiz_passed) return;
        const uid = String(row.user_id);
        const modules = progressByUser.get(uid) || new Set<number>();
        modules.add(row.module_no);
        progressByUser.set(uid, modules);
    });

    const learnersWithProgress = learners.map(learner => {
        const completedModules = learner.userId ? (progressByUser.get(learner.userId)?.size || 0) : 0;
        const percent = Math.floor((completedModules / totalModules) * 100);
        return {
            name: learner.fullName,
            email: learner.email,
            completedModules,
            totalModules,
            percent,
        };
    });

    // Sort and limit
    const sorted = learnersWithProgress.sort((a, b) =>
        sortOrder === 'desc' ? b.percent - a.percent : a.percent - b.percent
    );

    return sorted.slice(0, limit);
}

/**
 * Get individual learner's progress details
 */
export async function getLearnerProgress(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const { courseId, learnerEmail } = params;

    // Find learner by email
    const user = await prisma.user.findUnique({
        where: { email: learnerEmail.toLowerCase() },
        select: { userId: true, fullName: true, email: true, createdAt: true },
    });

    if (!user) {
        return { error: true, message: `Learner with email ${learnerEmail} not found` };
    }

    // Verify learner is enrolled in this course
    const enrollment = await prisma.enrollment.findFirst({
        where: { userId: user.userId, courseId },
    });

    if (!enrollment) {
        return { error: true, message: `${user.fullName} is not enrolled in this course` };
    }

    // Get total modules
    const maxModule = await prisma.topic.aggregate({
        where: { courseId, moduleNo: { gt: 0 } },
        _max: { moduleNo: true },
    });
    const totalModules = maxModule._max.moduleNo || 8;

    // Get progress
    const progressRows = await prisma.$queryRaw<
        { module_no: number; quiz_passed: boolean; updated_at: Date }[]
    >(Prisma.sql`
    SELECT module_no, quiz_passed, updated_at
    FROM module_progress
    WHERE course_id::text = ${courseId}
    AND user_id::text = ${user.userId}
    ORDER BY module_no ASC
  `);

    // Get absolute latest activity from events table (Browser signals, idle heartbeats, friction)
    const latestEvent = await prisma.learnerActivityEvent.findFirst({
        where: { userId: user.userId, courseId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
    });

    const completedModules = progressRows.filter(r => r.quiz_passed).length;
    const percent = Math.floor((completedModules / totalModules) * 100);

    // Final last activity is the max of progress updates or browser events
    let lastActivity = progressRows.length > 0 ? progressRows[progressRows.length - 1].updated_at : user.createdAt;
    if (latestEvent && latestEvent.createdAt > lastActivity) {
        lastActivity = latestEvent.createdAt;
    }

    return {
        name: user.fullName,
        email: user.email,
        completedModules,
        totalModules,
        percent,
        lastActivity,
        moduleDetails: progressRows.map(r => ({
            moduleNo: r.module_no,
            completed: r.quiz_passed,
            completedAt: r.updated_at,
        })),
    };
}

// ============================================================================
// COHORT ANALYTICS QUERIES
// ============================================================================

/**
 * Get cohort statistics
 */
export async function getCohortStats(params: {
    courseId: string;
    cohortId: string;
}) {
    const { courseId, cohortId } = params;

    // Verify cohort belongs to course
    const cohort = await prisma.cohort.findFirst({
        where: { cohortId, courseId },
        select: { name: true, isActive: true, startsAt: true, endsAt: true },
    });

    if (!cohort) {
        return { error: true, message: 'Cohort not found or does not belong to this course' };
    }

    // Get members
    const members = await prisma.cohortMember.findMany({
        where: { cohortId },
        select: { userId: true },
    });

    const totalMembers = members.length;
    const userIds = members.map(m => m.userId).filter((id): id is string => id !== null);

    // Get total modules
    const maxModule = await prisma.topic.aggregate({
        where: { courseId, moduleNo: { gt: 0 } },
        _max: { moduleNo: true },
    });
    const totalModules = maxModule._max.moduleNo || 8;

    // Get progress
    const progressRows = await prisma.$queryRaw<
        { user_id: string; module_no: number; quiz_passed: boolean }[]
    >(Prisma.sql`
    SELECT user_id::text as user_id, module_no, quiz_passed
    FROM module_progress
    WHERE course_id::text = ${courseId}
    AND user_id::text IN (${Prisma.join(userIds)})
  `);

    const progressByUser = new Map<string, Set<number>>();
    progressRows.forEach(row => {
        if (!row.quiz_passed) return;
        const uid = String(row.user_id);
        const modules = progressByUser.get(uid) || new Set<number>();
        modules.add(row.module_no);
        progressByUser.set(uid, modules);
    });

    let totalCompletion = 0;
    userIds.forEach(userId => {
        const completed = progressByUser.get(userId)?.size || 0;
        const percent = Math.floor((completed / totalModules) * 100);
        totalCompletion += percent;
    });

    const averageCompletion = userIds.length > 0 ? Math.floor(totalCompletion / userIds.length) : 0;

    return {
        cohortName: cohort.name,
        isActive: cohort.isActive,
        startsAt: cohort.startsAt,
        endsAt: cohort.endsAt,
        totalMembers,
        averageCompletion,
        totalModules,
    };
}

/**
 * Compare multiple cohorts
 */
export async function compareCohorts(params: {
    courseId: string;
    cohortIds: string[];
}) {
    const { courseId, cohortIds } = params;

    const results = await Promise.all(
        cohortIds.map(cohortId => getCohortStats({ courseId, cohortId }))
    );

    return results;
}

// ============================================================================
// ACTIVITY & ENGAGEMENT QUERIES
// ============================================================================

/**
 * Get learners active in the last N days
 */
export async function getActiveLearners(params: {
    courseId: string;
    cohortId?: string;
    days: number;
}) {
    const { courseId, cohortId, days } = params;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get learners
    let userIds: string[];
    if (cohortId) {
        const members = await prisma.cohortMember.findMany({
            where: { cohortId, cohort: { courseId } },
            select: { userId: true },
        });
        userIds = members.map(m => m.userId).filter((id): id is string => id !== null);
    } else {
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId },
            select: { userId: true },
        });
        userIds = enrollments.map(e => e.userId);
    }

    // Get recent activity
    const activeUsers = await prisma.$queryRaw<
        { user_id: string; last_activity: Date }[]
    >(Prisma.sql`
    SELECT DISTINCT user_id::text as user_id, MAX(updated_at) as last_activity
    FROM module_progress
    WHERE course_id::text = ${courseId}
    AND user_id::text IN (${Prisma.join(userIds)})
    AND updated_at >= ${cutoffDate}
    GROUP BY user_id
  `);

    // Get user details
    const activeUserIds = activeUsers.map(u => u.user_id);
    const users = await prisma.user.findMany({
        where: { userId: { in: activeUserIds } },
        select: { userId: true, fullName: true, email: true },
    });

    return users.map(user => {
        const activity = activeUsers.find(a => a.user_id === user.userId);
        return {
            name: user.fullName,
            email: user.email,
            lastActivity: activity?.last_activity,
        };
    });
}

/**
 * Get at-risk learners (low completion, inactive)
 */
export async function getAtRiskLearners(params: {
    courseId: string;
    cohortId?: string;
    thresholdPercent: number;
}) {
    const { courseId, cohortId, thresholdPercent } = params;

    const topLearners = await getTopLearnersByCohort({
        courseId,
        cohortId,
        limit: 100,
        sortOrder: 'asc', // Get lowest performers
    });

    return topLearners.filter(l => l.percent < thresholdPercent);
}

/**
 * Find which cohort(s) a learner belongs to
 */
export async function findLearnerCohort(params: {
    courseId: string;
    learnerNameOrEmail: string;
}) {
    const { courseId, learnerNameOrEmail } = params;
    const searchTerm = learnerNameOrEmail.toLowerCase().trim();

    // Search in cohort members
    const members = await prisma.cohortMember.findMany({
        where: {
            cohort: { courseId },
            OR: [
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { user: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
            ],
        },
        include: {
            cohort: {
                select: { cohortId: true, name: true, isActive: true },
            },
            user: {
                select: { fullName: true, email: true },
            },
        },
    });

    if (members.length === 0) {
        return {
            error: true,
            message: `No learner found matching "${learnerNameOrEmail}" in this course`,
        };
    }

    return members.map(member => ({
        learnerName: member.user?.fullName || member.email.split('@')[0],
        learnerEmail: member.email,
        cohortId: member.cohort.cohortId,
        cohortName: member.cohort.name,
        isActive: member.cohort.isActive,
    }));
}

/**
 * Search learners by partial name or email
 */
export async function searchLearnersByPartialName(params: {
    courseId: string;
    searchTerm: string;
}) {
    const { courseId, searchTerm } = params;
    const term = searchTerm.toLowerCase().trim();

    const enrollments = await prisma.enrollment.findMany({
        where: {
            courseId,
            OR: [
                { user: { fullName: { contains: term, mode: 'insensitive' } } },
                { user: { email: { contains: term, mode: 'insensitive' } } },
            ],
        },
        include: { user: { select: { fullName: true, email: true } } },
    });

    return enrollments.map(e => ({
        name: e.user.fullName,
        email: e.user.email,
    }));
}

/**
 * Get learner by any identifier (name, email, or user ID)
 */
export async function getLearnerByAnyIdentifier(params: {
    courseId: string;
    identifier: string;
}) {
    const { courseId, identifier } = params;
    const term = identifier.toLowerCase().trim();

    // Try finding by exact email first
    let user = await prisma.user.findFirst({
        where: {
            email: term,
            enrollments: { some: { courseId } },
        },
        select: { userId: true, fullName: true, email: true },
    });

    // If not found, try finding by name
    if (!user) {
        user = await prisma.user.findFirst({
            where: {
                fullName: { equals: term, mode: 'insensitive' },
                enrollments: { some: { courseId } },
            },
            select: { userId: true, fullName: true, email: true },
        });
    }

    // Still not found, try partial name search
    if (!user) {
        const partial = await searchLearnersByPartialName({ courseId, searchTerm: term });
        if (partial.length > 0) {
            // Return progress for the first match
            return await getLearnerProgress({ courseId, learnerEmail: partial[0].email });
        }
        return { error: true, message: `Learner "${identifier}" not found in this course` };
    }

    return await getLearnerProgress({ courseId, learnerEmail: user.email });
}

/**
 * Compare progress of two learners
 */
export async function compareTwoLearners(params: {
    courseId: string;
    email1: string;
    email2: string;
}) {
    const { courseId, email1, email2 } = params;

    const [learner1, learner2] = await Promise.all([
        getLearnerProgress({ courseId, learnerEmail: email1 }),
        getLearnerProgress({ courseId, learnerEmail: email2 }),
    ]);

    return { learner1, learner2 };
}

/**
 * Compare a learner's progress to their cohort average
 */
export async function compareLearnerToCohortAverage(params: {
    courseId: string;
    learnerEmail: string;
    cohortId: string;
}) {
    const { courseId, learnerEmail, cohortId } = params;

    const [learner, cohort] = await Promise.all([
        getLearnerProgress({ courseId, learnerEmail }),
        getCohortStats({ courseId, cohortId }),
    ]);

    return { learner, cohortAverage: cohort };
}

/**
 * Get progress for a specific module
 */
export async function getLearnerModuleProgress(params: {
    courseId: string;
    learnerEmail: string;
    moduleNo: number;
}) {
    const { courseId, learnerEmail, moduleNo } = params;

    const user = await prisma.user.findUnique({
        where: { email: learnerEmail.toLowerCase() },
        select: { userId: true },
    });

    if (!user) return { error: true, message: "Learner not found" };

    const progress = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT * FROM module_progress
        WHERE course_id::text = ${courseId}
        AND user_id::text = ${user.userId}
        AND module_no = ${moduleNo}
    `);

    if (progress.length === 0) {
        return { moduleNo, completed: false, attempts: 0 };
    }

    return {
        moduleNo,
        completed: progress[0].quiz_passed,
        attempts: progress.length,
        lastAttempt: progress[progress.length - 1].updated_at,
    };
}

/**
 * Get modules currently in progress
 */
export async function getModulesInProgress(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const { courseId, learnerEmail } = params;
    const progress = await getLearnerProgress({ courseId, learnerEmail });

    if ('error' in progress) return progress;

    const inProgress = progress.moduleDetails.filter(m => !m.completed);
    return inProgress.length > 0 ? inProgress[0] : { message: "All modules completed" };
}

/**
 * Get the next module a learner should work on
 */
export async function getNextModuleForLearner(params: {
    courseId: string;
    learnerEmail: string;
}) {
    return await getModulesInProgress(params);
}

/**
 * Rank all learners in a cohort
 */
export async function rankLearnersInCohort(params: {
    courseId: string;
    cohortId: string;
}) {
    return await getTopLearnersByCohort({
        ...params,
        limit: 1000,
        sortOrder: 'desc',
    });
}

/**
 * Get all learner emails in the course
 */
export async function getAllLearnerEmails(params: { courseId: string }) {
    const enrollments = await prisma.enrollment.findMany({
        where: { courseId: params.courseId },
        include: { user: { select: { email: true } } },
    });
    return enrollments.map(e => e.user.email);
}

/**
 * Validate if a learner exists
 */
export async function validateLearnerExists(params: {
    courseId: string;
    identifier: string;
}) {
    const result = await getLearnerByAnyIdentifier(params);
    return !('error' in result);
}

/**
 * Find similar learner names (fuzzy search)
 */
export async function findSimilarLearnerNames(params: {
    courseId: string;
    name: string;
}) {
    return await searchLearnersByPartialName({
        courseId: params.courseId,
        searchTerm: params.name,
    });
}

/**
 * Compare progress of multiple learners
 */
export async function compareMultipleLearners(params: {
    courseId: string;
    emails: string[];
}) {
    const { courseId, emails } = params;
    const results = await Promise.all(
        emails.map(email => getLearnerProgress({ courseId, learnerEmail: email }))
    );
    return results;
}

/**
 * Get detailed attempt history for a module
 */
export async function getModuleAttemptHistory(params: {
    courseId: string;
    learnerEmail: string;
    moduleNo: number;
}) {
    const { courseId, learnerEmail, moduleNo } = params;
    const user = await prisma.user.findUnique({
        where: { email: learnerEmail.toLowerCase() },
        select: { userId: true },
    });

    if (!user) return { error: true, message: "Learner not found" };

    return await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT module_no, quiz_passed, updated_at
        FROM module_progress
        WHERE course_id::text = ${courseId}
        AND user_id::text = ${user.userId}
        AND module_no = ${moduleNo}
        ORDER BY updated_at ASC
    `);
}

/**
 * List modules where the learner has failed quizzes
 */
export async function getFailedModules(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const { courseId, learnerEmail } = params;
    const progress = await getLearnerProgress({ courseId, learnerEmail });

    if ('error' in progress) return progress;

    return progress.moduleDetails.filter(m => !m.completed);
}

/**
 * Estimate completion date based on current progress rate
 */
export async function getEstimatedCompletionDate(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const { courseId, learnerEmail } = params;
    const progress = await getLearnerProgress({ courseId, learnerEmail });

    if ('error' in progress) return progress;

    if (progress.percent === 100) return { message: "Already completed" };
    if (progress.percent === 0) return { message: "Not started yet" };

    // Simple estimation: (remaining modules / modules completed) * days since enrollment
    // or just say "at current pace, [X] more weeks"
    const remaining = progress.totalModules - progress.completedModules;
    return {
        remainingModules: remaining,
        estimatedWeeks: Math.ceil(remaining * 1.5), // Arbitrary multiplier
    };
}

/**
 * Custom engagement metric (0-100)
 */
export async function getEngagementScore(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const progress = await getLearnerProgress(params);

    if ('error' in progress) return progress;

    const res = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT COUNT(*) as count 
        FROM module_progress mp 
        JOIN users u ON mp.user_id::uuid = u.user_id 
        WHERE mp.course_id::text = ${params.courseId} 
        AND u.email = ${params.learnerEmail.toLowerCase()}
    `);
    const activityCount = Number(res[0].count);

    const completionScore = progress.percent;
    const activityScore = Math.min(100, activityCount * 5);

    return {
        score: Math.floor((completionScore * 0.7) + (activityScore * 0.3)),
        completionPercent: progress.percent,
        activityCount,
    };
}

/**
 * Get learners not active in last N days
 */
export async function getInactiveLearners(params: {
    courseId: string;
    cohortId?: string;
    days: number;
}) {
    const all = await rankLearnersInCohort({ courseId: params.courseId, cohortId: params.cohortId || "" });
    const active = await getActiveLearners(params);
    const activeEmails = new Set(active.map(a => a.email));
    return all.filter(l => !activeEmails.has(l.email));
}

/**
 * Get learners active in last N hours
 */
export async function getRecentlyActiveLearners(params: {
    courseId: string;
    hours: number;
}) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - params.hours);

    const activeUsers = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT DISTINCT ON (mp.user_id) u.full_name as "fullName", u.email, mp.updated_at as "updatedAt"
        FROM module_progress mp
        JOIN users u ON mp.user_id::uuid = u.user_id
        WHERE mp.course_id::text = ${params.courseId}
        AND mp.updated_at >= ${cutoff}
    `);

    return activeUsers.map(a => ({
        name: a.fullName,
        email: a.email,
        lastActivity: a.updatedAt,
    }));
}

/**
 * Detailed activity history for a learner
 */
export async function getLearnerActivityHistory(params: {
    courseId: string;
    learnerEmail: string;
    days: number;
}) {
    const user = await prisma.user.findUnique({
        where: { email: params.learnerEmail.toLowerCase() },
        select: { userId: true },
    });
    if (!user) return { error: true, message: "Learner not found" };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - params.days);

    return await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT module_no, quiz_passed, updated_at as "updatedAt"
        FROM module_progress
        WHERE user_id::text = ${user.userId}
        AND course_id::text = ${params.courseId}
        AND updated_at >= ${cutoff}
        ORDER BY updated_at DESC
    `);
}

/**
 * Get most frequently active learners
 */
export async function getMostActiveLearners(params: {
    courseId: string;
    limit: number;
}) {
    const activityCounts = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT user_id, COUNT(*) as "count"
        FROM module_progress
        WHERE course_id::text = ${params.courseId}
        GROUP BY user_id
        ORDER BY "count" DESC
        LIMIT ${params.limit}
    `);

    const userIds = activityCounts.map(a => a.user_id);
    const users = await prisma.user.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, fullName: true, email: true },
    });

    return activityCounts.map(a => {
        const user = users.find(u => u.userId === a.user_id);
        return {
            name: user?.fullName,
            email: user?.email,
            activityCount: Number(a.count),
        };
    });
}

/**
 * Get least frequently active learners
 */
export async function getLeastActiveLearners(params: {
    courseId: string;
    limit: number;
}) {
    const activityCounts = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT user_id, COUNT(*) as "count"
        FROM module_progress
        WHERE course_id::text = ${params.courseId}
        GROUP BY user_id
        ORDER BY "count" ASC
        LIMIT ${params.limit}
    `);

    const userIds = activityCounts.map(a => a.user_id);
    const users = await prisma.user.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, fullName: true, email: true },
    });

    return activityCounts.map(a => {
        const user = users.find(u => u.userId === a.user_id);
        return {
            name: user?.fullName,
            email: user?.email,
            activityCount: Number(a.count),
        };
    });
}

/**
 * Get activity breakdown by hour of day
 */
export async function getActivityByTimeOfDay(params: { courseId: string }) {
    const activity = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT updated_at as "updatedAt"
        FROM module_progress
        WHERE course_id::text = ${params.courseId}
    `);

    const hoursBreakdown: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hoursBreakdown[i] = 0;

    activity.forEach(a => {
        const hour = new Date(a.updatedAt).getHours();
        hoursBreakdown[hour]++;
    });

    return hoursBreakdown;
}

/**
 * Get activity breakdown by day of week
 */
export async function getActivityByDayOfWeek(params: { courseId: string }) {
    const activity = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT updated_at as "updatedAt"
        FROM module_progress
        WHERE course_id::text = ${params.courseId}
    `);

    const daysBreakdown: Record<string, number> = {
        "Sunday": 0, "Monday": 0, "Tuesday": 0, "Wednesday": 0,
        "Thursday": 0, "Friday": 0, "Saturday": 0
    };
    const daysArr = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    activity.forEach(a => {
        const day = daysArr[new Date(a.updatedAt).getDay()];
        daysBreakdown[day]++;
    });

    return daysBreakdown;
}

/**
 * Identify learners at risk of dropping out
 */
export async function getDropoutRiskLearners(params: { courseId: string }) {
    const atRisk = await getAtRiskLearners({ ...params, thresholdPercent: 20 });
    const inactive = await getActiveLearners({ ...params, days: 7 });
    const activeEmails = new Set(inactive.map(i => i.email));

    return atRisk.filter(l => !activeEmails.has(l.email));
}

/**
 * Learners with < 30% completion
 */
export async function getStrugglingLearners(params: {
    courseId: string;
    cohortId?: string;
}) {
    return await getAtRiskLearners({ ...params, thresholdPercent: 30 });
}

/**
 * No progress recorded in last N days
 */
export async function getStagnantLearners(params: {
    courseId: string;
    days: number;
}) {
    return await getInactiveLearners(params);
}

/**
 * Learners who failed quizzes 3+ times
 */
export async function getLearnersNeedingHelp(params: { courseId: string }) {
    const attempts = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT user_id, module_no, COUNT(*) as count 
        FROM module_progress 
        WHERE course_id::text = ${params.courseId} AND quiz_passed = false 
        GROUP BY user_id, module_no 
        HAVING COUNT(*) >= 3
    `);

    const userIds = attempts.map(n => n.user_id);
    const users = await prisma.user.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, fullName: true, email: true },
    });

    return attempts.map(n => {
        const user = users.find(u => u.userId === n.user_id);
        return {
            name: user?.fullName,
            email: user?.email,
            moduleNo: n.module_no,
            failedAttempts: Number(n.count),
        };
    });
}

/**
 * Check if a learner is stuck
 */
export async function getStuckIndicators(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const progress = await getLearnerProgress(params);
    if ("error" in progress) return progress;

    const user = await prisma.user.findUnique({
        where: { email: params.learnerEmail.toLowerCase() },
        select: { userId: true },
    });
    if (!user) return { error: true, message: "Learner not found" };

    // Get signals for last 7 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const signals = await prisma.learnerActivityEvent.findMany({
        where: {
            userId: user.userId,
            courseId: params.courseId,
            createdAt: { gte: cutoff },
            derivedStatus: { in: ['content_friction', 'attention_drift'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    const lastActivity = new Date(progress.lastActivity);
    const diff = (new Date().getTime() - lastActivity.getTime()) / (1000 * 3600 * 24);

    if (diff > 3 && progress.percent < 100) {
        return {
            stuck: true,
            lastActivity,
            reason: signals.length > 0 ? signals[0].statusReason : "Inactivity on current module"
        };
    }
    return { stuck: false, recentSignals: signals.map(s => s.statusReason) };
}

/**
 * Learners who appear stuck
 */
export async function getLearnersStuckOnModule(params: {
    courseId: string;
    moduleNo: number;
}) {
    return await getLearnersFailedModule(params);
}

/**
 * Detailed module aggregate stats
 */
export async function getModuleStatistics(params: {
    courseId: string;
    moduleNo: number;
}) {
    const rate = await getModuleCompletionRate(params);
    const res = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT COUNT(*) as count 
        FROM module_progress 
        WHERE course_id::text = ${params.courseId} AND module_no = ${params.moduleNo}
    `);
    return { ...rate, totalAttempts: Number(res[0].count) };
}

/**
 * List all who finished a module
 */
export async function getLearnersCompletedModule(params: {
    courseId: string;
    moduleNo: number;
}) {
    const completions = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT u.full_name as "fullName", u.email 
        FROM module_progress mp 
        JOIN users u ON mp.user_id::uuid = u.user_id 
        WHERE mp.course_id::text = ${params.courseId} AND mp.module_no = ${params.moduleNo} AND mp.quiz_passed = true
    `);
    return completions.map(c => ({ name: c.fullName, email: c.email }));
}

/**
 * List all who have failed a module so far
 */
export async function getLearnersFailedModule(params: {
    courseId: string;
    moduleNo: number;
}) {
    const fails = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT u.full_name as "fullName", u.email 
        FROM module_progress mp 
        JOIN users u ON mp.user_id::uuid = u.user_id 
        WHERE mp.course_id::text = ${params.courseId} AND mp.module_no = ${params.moduleNo} AND mp.quiz_passed = false
    `);
    return fails.map(f => ({ name: f.fullName, email: f.email }));
}

/**
 * Avg attempts per module
 */
export async function getModuleAverageAttempts(params: {
    courseId: string;
    moduleNo: number;
}) {
    const resCount = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT COUNT(*) as count 
        FROM module_progress 
        WHERE course_id::text = ${params.courseId} AND module_no = ${params.moduleNo}
    `);
    const totalAttempts = Number(resCount[0].count);

    const resUsers = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT DISTINCT user_id 
        FROM module_progress 
        WHERE course_id::text = ${params.courseId} AND module_no = ${params.moduleNo}
    `);
    const uniqueUsersCount = resUsers.length;

    const avg = uniqueUsersCount > 0 ? (totalAttempts / uniqueUsersCount).toFixed(2) : 0;
    return { moduleNo: params.moduleNo, averageAttempts: avg };
}

/**
 * Rank modules by failure/difficulty
 */
export async function getModuleDifficultyRanking(params: { courseId: string }) {
    const modules = await getCourseModuleList(params);
    const difficulties = await Promise.all(
        modules.map(async m => {
            const avg = await getModuleAverageAttempts({
                courseId: params.courseId,
                moduleNo: m.moduleNo,
            });
            return { moduleNo: m.moduleNo, title: m.moduleName, avgAttempts: avg.averageAttempts };
        })
    );
    return difficulties.sort((a, b) => Number(b.avgAttempts) - Number(a.avgAttempts));
}

/**
 * Progress growth over time
 */
export async function getProgressOverTime(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const history = await getLearnerActivityHistory({ ...params, days: 365 });
    if ("error" in history) return history;

    return (history as any[])
        .filter((h: any) => h.quiz_passed)
        .sort((a: any, b: any) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

/**
 * Cohort enrollment trend
 */
export async function getEnrollmentTrend(params: {
    courseId: string;
    months: number;
}) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - params.months);

    return await prisma.enrollment.findMany({
        where: { courseId: params.courseId, enrolledAt: { gte: cutoff } },
        select: { enrolledAt: true },
        orderBy: { enrolledAt: "asc" },
    });
}

/**
 * "Why" diagnostic functions
 */

export async function getLearnerActivitySignals(params: {
    courseId: string;
    learnerEmail: string;
    days: number;
}) {
    const user = await prisma.user.findUnique({
        where: { email: params.learnerEmail.toLowerCase() },
        select: { userId: true },
    });
    if (!user) return { error: true, message: "Learner not found" };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - params.days);

    const events = await prisma.learnerActivityEvent.findMany({
        where: {
            userId: user.userId,
            courseId: params.courseId,
            createdAt: { gte: cutoff },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    if (events.length === 0) {
        return { signals: [], message: `No specific activity signals found for the last ${params.days} days.` };
    }

    // Map events to user-friendly signals
    const signals = events.map(e => ({
        type: e.eventType,
        status: e.derivedStatus,
        reason: e.statusReason,
        timestamp: e.createdAt,
        moduleNo: e.moduleNo,
    }));

    return { signals };
}

export async function getModuleFailureReasons(params: {
    courseId: string;
    learnerEmail: string;
    moduleNo: number;
}) {
    const user = await prisma.user.findUnique({
        where: { email: params.learnerEmail.toLowerCase() },
        select: { userId: true },
    });
    if (!user) return { error: true, message: "Learner not found" };

    const signals = await prisma.learnerActivityEvent.findMany({
        where: {
            userId: user.userId,
            courseId: params.courseId,
            moduleNo: params.moduleNo,
            derivedStatus: { in: ['content_friction', 'attention_drift'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    const attempts = await getModuleAttemptHistory(params) as any[];

    return {
        failedQuizAttempts: attempts.length,
        frictionSignals: signals.map(s => s.statusReason),
        message: attempts.length > 0 ? `The learner failed the quiz ${attempts.length} times.` : "No quiz failures found."
    };
}

export async function getDropoffPoints(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const progress = await getLearnerProgress(params);
    if ("error" in progress) return progress;
    return { lastModuleCompleted: progress.completedModules, dropoffModule: progress.completedModules + 1 };
}

export async function getCohortPerformanceFactors(params: {
    courseId: string;
    cohortId: string;
}) {
    const stats = await getCohortStats(params);
    return {
        factors: ["High engagement", "Regular activity"],
        averageCompletion: (stats as any).averageCompletion
    };
}

export async function getProgressBlockers(params: {
    courseId: string;
    learnerEmail: string;
}) {
    return await getStuckIndicators(params);
}

/**
 * Get all learners in the course
 */
export async function getAllLearnersInCourse(params: { courseId: string }) {
    const enrollments = await prisma.enrollment.findMany({
        where: { courseId: params.courseId },
        include: { user: { select: { fullName: true, email: true } } },
    });
    return enrollments.map(e => ({ name: e.user.fullName, email: e.user.email }));
}

/**
 * Get all learners in a specific cohort
 */
export async function getAllLearnersInCohort(params: {
    courseId: string;
    cohortId: string;
}) {
    const members = await prisma.cohortMember.findMany({
        where: { cohortId: params.cohortId, cohort: { courseId: params.courseId } },
        include: { user: { select: { fullName: true, email: true } } },
    });
    return members.map(m => ({
        name: m.user?.fullName || m.email.split("@")[0],
        email: m.email,
    }));
}

/**
 * Get full learner details
 */
export async function getLearnerDetails(params: {
    courseId: string;
    learnerEmail: string;
}) {
    return await getLearnerProgress(params);
}

/**
 * Get when a learner enrolled in the course
 */
export async function getLearnerEnrollmentDate(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const user = await prisma.user.findUnique({
        where: { email: params.learnerEmail.toLowerCase() },
        select: { userId: true },
    });
    if (!user) return { error: true, message: "Learner not found" };

    const enrollment = await prisma.enrollment.findFirst({
        where: { userId: user.userId, courseId: params.courseId },
        select: { enrolledAt: true },
    });
    return enrollment ? { enrollmentDate: enrollment.enrolledAt } : { error: true, message: "Not enrolled" };
}

/**
 * Get last activity time for a learner
 */
export async function getLearnerLastActivity(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const progress = await getLearnerProgress(params);
    if ("error" in progress) return progress;
    return { lastActivity: progress.lastActivity };
}

/**
 * List all modules completed by a learner
 */
export async function getLearnerCompletedModules(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const progress = await getLearnerProgress(params);
    if ("error" in progress) return progress;
    return progress.moduleDetails.filter(m => m.completed);
}

/**
 * List all modules not yet completed by a learner
 */
export async function getLearnerIncompleteModules(params: {
    courseId: string;
    learnerEmail: string;
}) {
    const progress = await getLearnerProgress(params);
    if ("error" in progress) return progress;
    return progress.moduleDetails.filter(m => !m.completed);
}

/**
 * List all cohorts in the course
 */
export async function getAllCohortsInCourse(params: { courseId: string }) {
    return await prisma.cohort.findMany({
        where: { courseId: params.courseId },
        select: { cohortId: true, name: true, isActive: true },
    });
}

/**
 * List only active cohorts
 */
export async function getActiveCohorts(params: { courseId: string }) {
    return await prisma.cohort.findMany({
        where: { courseId: params.courseId, isActive: true },
        select: { cohortId: true, name: true },
    });
}

/**
 * Get number of members in a cohort
 */
export async function getCohortMemberCount(params: {
    courseId: string;
    cohortId: string;
}) {
    const count = await prisma.cohortMember.count({
        where: { cohortId: params.cohortId, cohort: { courseId: params.courseId } },
    });
    return { count };
}

/**
 * Get average completion percentage for a cohort
 */
export async function getCohortAverageCompletion(params: {
    courseId: string;
    cohortId: string;
}) {
    const stats = await getCohortStats(params);
    if ("error" in stats) return stats;
    return { averageCompletion: stats.averageCompletion };
}

/**
 * Get top performers in a cohort
 */
export async function getCohortTopPerformers(params: {
    courseId: string;
    cohortId: string;
    limit: number;
}) {
    return await getTopLearnersByCohort({ ...params, sortOrder: "desc" });
}

/**
 * Get struggling performers in a cohort
 */
export async function getCohortBottomPerformers(params: {
    courseId: string;
    cohortId: string;
    limit: number;
}) {
    return await getTopLearnersByCohort({ ...params, sortOrder: "asc" });
}

/**
 * Get distribution of completion percentages in a cohort
 */
export async function getCohortCompletionDistribution(params: {
    courseId: string;
    cohortId: string;
}) {
    const learners = await getTopLearnersByCohort({
        ...params,
        limit: 1000,
        sortOrder: "desc",
    });

    const ranges = {
        "0-20%": 0,
        "21-40%": 0,
        "41-60%": 0,
        "61-80%": 0,
        "81-100%": 0,
    };

    learners.forEach(l => {
        if (l.percent <= 20) ranges["0-20%"]++;
        else if (l.percent <= 40) ranges["21-40%"]++;
        else if (l.percent <= 60) ranges["41-60%"]++;
        else if (l.percent <= 80) ranges["61-80%"]++;
        else ranges["81-100%"]++;
    });

    return ranges;
}

/**
 * Get percentage of learners active in last N days for a cohort
 */
export async function getCohortActivityRate(params: {
    courseId: string;
    cohortId: string;
    days: number;
}) {
    const total = await getCohortMemberCount(params);
    const active = await getActiveLearners(params);
    const rate = total.count > 0 ? Math.floor((active.length / total.count) * 100) : 0;
    return { activeCount: active.length, totalCount: total.count, activityRate: rate };
}

/**
 * Get high-level overview of the course
 */
export async function getCourseOverview(params: { courseId: string }) {
    const [totalEnrollments, averageCompletion, activeCohorts] = await Promise.all([
        getTotalEnrollments(params),
        getCourseAverageCompletion(params),
        getActiveCohorts(params),
    ]);

    return {
        totalEnrollments: totalEnrollments.count,
        averageCompletion: averageCompletion.averageCompletion,
        activeCohortsCount: activeCohorts.length,
    };
}

/**
 * Get total number of enrollments in the course
 */
export async function getTotalEnrollments(params: { courseId: string }) {
    const count = await prisma.enrollment.count({ where: { courseId: params.courseId } });
    return { count };
}

/**
 * Get average completion percentage across all learners in the course
 */
export async function getCourseAverageCompletion(params: { courseId: string }) {
    const learners = await getTopLearnersByCohort({
        courseId: params.courseId,
        limit: 10000,
        sortOrder: "desc",
    });

    if (learners.length === 0) return { averageCompletion: 0 };

    const sum = learners.reduce((acc, l) => acc + l.percent, 0);
    return { averageCompletion: Math.floor(sum / learners.length) };
}

/**
 * List all modules/topics in the course
 */
export async function getCourseModuleList(params: { courseId: string }) {
    return await prisma.topic.findMany({
        where: { courseId: params.courseId, moduleNo: { gt: 0 } },
        select: { moduleNo: true, moduleName: true },
        distinct: ["moduleNo"],
        orderBy: { moduleNo: "asc" },
    });
}

/**
 * Get completion rate for a specific module across the course
 */
export async function getModuleCompletionRate(params: {
    courseId: string;
    moduleNo: number;
}) {
    const total = await getTotalEnrollments(params);
    const completedCount = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT COUNT(*) as count 
        FROM module_progress 
        WHERE course_id::text = ${params.courseId} AND module_no = ${params.moduleNo} AND quiz_passed = true
    `).then((res) => Number(res[0].count));

    const rate = total.count > 0 ? Math.floor((completedCount / total.count) * 100) : 0;
    return { moduleNo: params.moduleNo, completedCount, totalEnrollments: total.count, completionRate: rate };
}
