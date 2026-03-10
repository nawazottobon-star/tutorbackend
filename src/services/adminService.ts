import crypto from "node:crypto";
import { prisma } from "./prisma";
import { hashPassword } from "../shared/utils/password";

function slugify(value: string, fallback: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug.length > 0 ? slug : fallback;
}

export async function getTutorApplications() {
    return prisma.tutorApplication.findMany({
        orderBy: { createdAt: "desc" },
    });
}

export async function approveTutorApplication(applicationId: string) {
    const application = await prisma.tutorApplication.findUnique({
        where: { applicationId },
    });

    if (!application) {
        return { status: 404, message: "Application not found" };
    }

    if (application.status === "approved") {
        return { status: 200, message: "Application already approved" };
    }

    const email = application.email.trim().toLowerCase();
    const fullName = application.fullName.trim();
    const hashedPassword = await hashPassword(crypto.randomUUID());

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            fullName,
            role: "tutor",
        },
        create: {
            email,
            fullName,
            passwordHash: hashedPassword,
            role: "tutor",
        },
    });

    const tutor = await prisma.tutor.upsert({
        where: { userId: user.userId },
        update: {
            displayName: fullName,
            bio: application.expertiseArea ?? application.headline ?? null,
        },
        create: {
            userId: user.userId,
            displayName: fullName,
            bio: application.expertiseArea ?? application.headline ?? null,
        },
    });

    const courseTitle =
        application.courseTitle?.trim() ||
        application.courseDescription?.slice(0, 64)?.trim() ||
        `${application.fullName}'s Course`;
    const courseSlug = slugify(courseTitle, `course-${crypto.randomUUID()}`);
    const courseDescription =
        application.courseDescription?.trim() || "Course description to be provided by tutor.";

    const course = await prisma.course.upsert({
        where: { slug: courseSlug },
        update: {
            courseName: courseTitle,
            description: courseDescription,
        },
        create: {
            slug: courseSlug,
            courseName: courseTitle,
            description: courseDescription,
            priceCents: 0,
            category: "General",
            level: "Beginner",
            instructor: application.fullName,
            durationMinutes: 0,
            rating: 4.5,
            students: 0,
            isFeatured: false,
        },
    });

    await prisma.courseTutor.upsert({
        where: {
            courseId_tutorId: {
                courseId: course.courseId,
                tutorId: tutor.tutorId,
            },
        },
        update: {
            role: "owner",
            isActive: true,
        },
        create: {
            courseId: course.courseId,
            tutorId: tutor.tutorId,
            role: "owner",
            isActive: true,
        },
    });

    await prisma.tutorApplication.update({
        where: { applicationId },
        data: { status: "approved" },
    });

    return {
        status: 200,
        data: {
            tutor: {
                tutorId: tutor.tutorId,
                userId: user.userId,
                fullName: user.fullName,
                email: user.email,
            },
            course: {
                courseId: course.courseId,
                slug: course.slug,
                title: course.courseName,
            },
            message: "Application approved and course created",
        },
    };
}
