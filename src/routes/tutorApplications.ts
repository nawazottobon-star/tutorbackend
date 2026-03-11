import express from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

const tutorApplicationsRouter = express.Router();

const applicationSchema = z.object({
  fullName: z.string().min(3).max(200),
  email: z.string().email().max(320),
  phone: z.string().min(10).max(30).optional(),
  headline: z.string().min(4).max(240),
  courseTitle: z.string().min(4).max(200),
  courseDescription: z.string().min(16).max(4000),
  targetAudience: z.string().min(4).max(2000),
  expertiseArea: z.string().min(2).max(200),
  experienceYears: z.number().int().min(0).max(60).optional(),
  availability: z.string().min(3).max(200),
});

tutorApplicationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid tutor application payload",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const payload = parsed.data;
    const application = await prisma.tutorApplication.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        headline: payload.headline,
        courseTitle: payload.courseTitle,
        courseDescription: payload.courseDescription,
        targetAudience: payload.targetAudience,
        expertiseArea: payload.expertiseArea,
        experienceYears: payload.experienceYears ?? null,
        availability: payload.availability,
      },
    });

    res.status(201).json({
      application: {
        id: application.applicationId,
        status: application.status,
        submittedAt: application.createdAt.toISOString(),
      },
    });
  }),
);

export { tutorApplicationsRouter };
