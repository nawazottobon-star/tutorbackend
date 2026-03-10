import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const LEGACY_COURSE_SLUGS: Record<string, string> = {
    "ai-in-web-development": "f26180b2-5dda-495a-a014-ae02e63f172f",
};

export const courseSelect = {
    courseId: true,
    courseName: true,
    description: true,
    priceCents: true,
    slug: true,
    createdAt: true,
} as const;

export type CourseRecord = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;

export function mapCourse(course: CourseRecord) {
    const priceCents = course.priceCents ?? 0;
    const createdAt = course.createdAt instanceof Date ? course.createdAt : new Date(course.createdAt ?? Date.now());

    return {
        id: course.courseId,
        slug: course.slug,
        title: course.courseName,
        description: course.description,
        price: Math.round(priceCents / 100),
        priceCents,
        createdAt: createdAt.toISOString(),
    };
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CourseResolution =
    | { courseId: string }
    | { errorStatus: number; errorMessage: string };

export async function resolveCourseIdOrError(courseKeyRaw: string | undefined): Promise<CourseResolution> {
    const courseKey = courseKeyRaw?.trim();
    if (!courseKey) {
        return { errorStatus: 400, errorMessage: "Course identifier is required" };
    }

    if (uuidRegex.test(courseKey)) {
        return { courseId: courseKey };
    }

    let decodedKey: string;
    try {
        decodedKey = decodeURIComponent(courseKey).trim();
    } catch {
        decodedKey = courseKey.trim();
    }

    const normalizedSlug = decodedKey.toLowerCase();
    const aliasMatch = LEGACY_COURSE_SLUGS[normalizedSlug];
    if (aliasMatch) {
        return { courseId: aliasMatch };
    }

    const normalizedName = decodedKey.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
    const searchNames = Array.from(
        new Set(
            [decodedKey, normalizedName]
                .map((value) => value.trim())
                .filter((value) => value.length > 0),
        ),
    );

    if (searchNames.length === 0) {
        return { errorStatus: 400, errorMessage: "Course identifier is required" };
    }

    const courseRecord = await prisma.course.findFirst({
        where: {
            OR: searchNames.map((name) => ({
                courseName: {
                    equals: name,
                    mode: "insensitive",
                },
            })),
        },
        select: { courseId: true },
    });

    if (!courseRecord) {
        return { errorStatus: 404, errorMessage: "Course not found" };
    }

    return { courseId: courseRecord.courseId };
}

export async function getAllCourses() {
    const courses = await prisma.course.findMany({
        select: courseSelect,
        orderBy: [{ createdAt: "asc" }],
    });
    return courses.map(mapCourse);
}

export async function getCourseById(courseId: string) {
    return prisma.course.findUnique({
        where: { courseId },
        select: courseSelect,
    });
}
