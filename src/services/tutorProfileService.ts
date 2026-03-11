import { prisma } from "./prisma.js";
import { verifyPassword } from "../shared/utils/password.js";
import { createSession } from "./sessionService.js";

export async function isTutorForCourse(userId: string, courseId: string): Promise<boolean> {
    const assignment = await prisma.courseTutor.findFirst({
        where: {
            courseId,
            isActive: true,
            tutor: { userId },
        },
        select: { courseTutorId: true },
    });
    return Boolean(assignment);
}

export async function checkTutorHasCourses(userId: string) {
    const count = await prisma.courseTutor.count({
        where: {
            isActive: true,
            tutor: { userId },
        },
    });
    return count > 0;
}

export async function getTutorCourses(userId: string) {
    const courses = await prisma.courseTutor.findMany({
        where: {
            isActive: true,
            tutor: { userId },
        },
        include: {
            course: {
                select: {
                    courseId: true,
                    courseName: true,
                    slug: true,
                    description: true,
                },
            },
        },
    });

    return courses.map((entry) => ({
        courseId: entry.course.courseId,
        slug: entry.course.slug,
        title: entry.course.courseName,
        description: entry.course.description,
        role: entry.role,
    }));
}

export async function loginTutor(emailRaw: string | undefined, passwordRaw: string | undefined) {
    const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : "";

    if (!email || !password) {
        return { status: 400, message: "Email and password are required" };
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            userId: true,
            email: true,
            fullName: true,
            role: true,
            passwordHash: true,
            tutorProfile: {
                select: {
                    tutorId: true,
                    displayName: true,
                },
            },
        },
    });

    if (!user || (user.role !== "tutor" && user.role !== "admin")) {
        return { status: 403, message: "Tutor account required" };
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
        return { status: 401, message: "Wrong email or wrong password" };
    }

    const tokens = await createSession(user.userId, user.role);

    return {
        status: 200,
        data: {
            user: {
                id: user.userId,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                tutorId: user.tutorProfile?.tutorId,
                displayName: user.tutorProfile?.displayName ?? user.fullName,
            },
            session: {
                accessToken: tokens.accessToken,
                accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
                refreshToken: tokens.refreshToken,
                refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
                sessionId: tokens.sessionId,
            },
        },
    };
}
