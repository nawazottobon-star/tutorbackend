import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function getCourseCohorts(courseId: string) {
    return prisma.cohort.findMany({
        where: { courseId },
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    });
}

function resolveDisplayName(fullName: string | null, email: string) {
    if (fullName) return fullName;
    const emailPrefix = email.split("@")[0];
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
}

export async function getCourseEnrollments(courseId: string, cohortId?: string) {
    if (cohortId) {
        const members = await prisma.cohortMember.findMany({
            where: { cohortId },
            include: {
                user: { select: { fullName: true } },
            },
            orderBy: { addedAt: "desc" },
        });

        return members.map((member) => ({
            enrollmentId: member.memberId,
            enrolledAt: member.addedAt,
            status: member.status,
            userId: member.userId,
            fullName: resolveDisplayName(member.user?.fullName ?? null, member.email),
            email: member.email,
        }));
    }

    const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        select: {
            enrollmentId: true,
            enrolledAt: true,
            status: true,
            user: {
                select: {
                    userId: true,
                    fullName: true,
                    email: true,
                },
            },
        },
        orderBy: { enrolledAt: "desc" },
    });

    return enrollments.map((enrollment) => ({
        enrollmentId: enrollment.enrollmentId,
        enrolledAt: enrollment.enrolledAt,
        status: enrollment.status,
        userId: enrollment.user.userId,
        fullName: enrollment.user.fullName,
        email: enrollment.user.email,
    }));
}

export async function getCourseProgressOverview(courseId: string, cohortId?: string) {
    const moduleNumbers = await prisma.topic.findMany({
        where: { courseId, moduleNo: { gt: 0 } },
        select: { moduleNo: true },
        distinct: ["moduleNo"],
        orderBy: { moduleNo: "asc" },
    });

    let totalModules = moduleNumbers.length;

    if (totalModules === 0) {
        const allTopics = await prisma.topic.count({ where: { courseId } });
        if (allTopics > 0) {
            const maxModule = await prisma.topic.aggregate({
                where: { courseId },
                _max: { moduleNo: true },
            });
            totalModules = maxModule._max.moduleNo || (allTopics > 0 ? 1 : 0);
        }
    }

    let targetUsers: { userId: string | null; email: string; fullName: string; enrolledAt: string }[] = [];

    if (cohortId) {
        const members = await prisma.cohortMember.findMany({
            where: { cohortId },
            include: { user: { select: { fullName: true } } },
        });
        targetUsers = members.map((m) => ({
            userId: m.userId,
            email: m.email,
            fullName: resolveDisplayName(m.user?.fullName ?? null, m.email),
            enrolledAt: m.addedAt.toISOString(),
        }));
    } else {
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId },
            include: { user: { select: { fullName: true, email: true } } },
        });
        targetUsers = enrollments.map((e) => ({
            userId: e.userId,
            email: e.user.email,
            fullName: resolveDisplayName(e.user.fullName ?? null, e.user.email),
            enrolledAt: e.enrolledAt.toISOString(),
        }));
    }

    const userIdsWithProgress = targetUsers
        .map((u) => u.userId)
        .filter((id): id is string => id !== null);

    let progressRows: { user_id: string; module_no: number; quiz_passed: boolean }[] = [];

    if (userIdsWithProgress.length > 0) {
        try {
            progressRows = await prisma.$queryRaw<{ user_id: string; module_no: number; quiz_passed: boolean }[]>(Prisma.sql`
        SELECT user_id, module_no, quiz_passed
        FROM module_progress
        WHERE course_id::text = ${courseId}
        AND user_id::text IN (${Prisma.join(userIdsWithProgress)})
      `);
        } catch {
            // Continue silently if module_progress table isn't supported / has issues
        }
    }

    const progressByUser = new Map<string, { passedModules: Set<number> }>();
    progressRows.forEach((row) => {
        if (!row.quiz_passed) return;
        const entry = progressByUser.get(row.user_id) ?? { passedModules: new Set<number>() };
        entry.passedModules.add(row.module_no);
        progressByUser.set(row.user_id, entry);
    });

    const learners = targetUsers.map((user) => {
        const progress = user.userId ? progressByUser.get(user.userId) : null;
        const completedCount = progress ? progress.passedModules.size : 0;
        const percent = totalModules === 0 ? 0 : Math.min(100, Math.floor((completedCount / totalModules) * 100));

        return {
            userId: user.userId || `temp-${user.email}`,
            fullName: user.fullName,
            email: user.email,
            enrolledAt: user.enrolledAt,
            completedModules: completedCount,
            totalModules,
            percent,
        };
    });

    return { learners, totalModules };
}
