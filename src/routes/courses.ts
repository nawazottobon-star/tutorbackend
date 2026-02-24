import express from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../services/prisma";
import { asyncHandler } from "../shared/utils/asyncHandler";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { ensureEnrollment } from "../services/enrollmentService";
import { checkCohortAccessForUser } from "../services/cohortAccess";

const LEGACY_COURSE_SLUGS: Record<string, string> = {
  "ai-in-web-development": "f26180b2-5dda-495a-a014-ae02e63f172f",
};

const coursesRouter = express.Router();

const courseSelect = {
  courseId: true,
  courseName: true,
  description: true,
  priceCents: true,
  slug: true,
  createdAt: true,
} as const;

type CourseRecord = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;

function mapCourse(course: CourseRecord) {
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

type CourseResolution =
  | { courseId: string }
  | { errorStatus: number; errorMessage: string };

async function resolveCourseIdOrError(courseKeyRaw: string | undefined): Promise<CourseResolution> {
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

coursesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const courses = await prisma.course.findMany({
      select: courseSelect,
      orderBy: [{ createdAt: "asc" }],
    });

    res.status(200).json({
      courses: courses.map(mapCourse),
    });
  }),
);

coursesRouter.get(
  "/:courseKey",
  asyncHandler(async (req, res) => {
    const resolved = await resolveCourseIdOrError(req.params.courseKey);
    if ("errorStatus" in resolved) {
      res.status(resolved.errorStatus).json({ message: resolved.errorMessage });
      return;
    }
    const resolvedCourseId = resolved.courseId;

    const course = await prisma.course.findUnique({
      where: { courseId: resolvedCourseId },
      select: courseSelect,
    });

    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    res.status(200).json({ course: mapCourse(course) });
  }),
);

coursesRouter.post(
  "/:courseKey/enroll",
  requireAuth,
  asyncHandler(async (req, res) => {
    const resolved = await resolveCourseIdOrError(req.params.courseKey);
    if ("errorStatus" in resolved) {
      res.status(resolved.errorStatus).json({ message: resolved.errorMessage });
      return;
    }

    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const cohortAccess = await checkCohortAccessForUser(auth.userId, resolved.courseId);
    if (!cohortAccess.allowed) {
      res.status(cohortAccess.status).json({ message: cohortAccess.message });
      return;
    }

    const checkOnly =
      (typeof req.query?.checkOnly === "string" && req.query.checkOnly === "true") ||
      req.body?.checkOnly === true;
    if (checkOnly) {
      res.status(204).end();
      return;
    }

    await ensureEnrollment(auth.userId, resolved.courseId);
    res.status(200).json({ status: "enrolled", courseId: resolved.courseId });
  }),
);

export { coursesRouter };
