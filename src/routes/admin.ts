import express from "express";
import crypto from "node:crypto";
import { asyncHandler } from "../shared/utils/asyncHandler";
import { prisma } from "../services/prisma";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireRole";
import { hashPassword } from "../shared/utils/password";

const adminRouter = express.Router();

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : fallback;
}

adminRouter.get(
  "/tutor-applications",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const applications = await prisma.tutorApplication.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ applications });
  }),
);

adminRouter.post(
  "/tutor-applications/:applicationId/approve",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const application = await prisma.tutorApplication.findUnique({
      where: { applicationId },
    });

    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (application.status === "approved") {
      res.status(200).json({ message: "Application already approved" });
      return;
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

    res.status(200).json({
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
    });
  }),
);

export { adminRouter };
