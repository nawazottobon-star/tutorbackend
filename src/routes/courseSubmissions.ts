import express from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { requireTutor } from "../middleware/requireRole.js";

const courseSubmissionsRouter = express.Router();

const fileItemSchema = z.object({
  name: z.string(),
  url: z.string(),
  type: z.string().optional()
});

const submissionSchema = z.object({
  courseName: z.string().min(1, "Course name is required"),
  description: z.string().min(1, "Description is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  durationWeeks: z.number().int().min(1).default(4),
  category: z.string().min(1, "Category is required").default("General"),
  moduleCount: z.number().int().min(1, "Module count must be at least 1"),
  priceHigh: z.number().min(0, "High price cannot be negative"),
  priceLow: z.number().min(0, "Low price cannot be negative"),
  discountPercent: z.number().int().min(0).max(100),
  apiKeyEncrypted: z.string().optional(),
  apiKeyHint: z.string().optional(),
  apiKeyProvider: z.string().optional(),
  uploadedDocuments: z.array(fileItemSchema).default([]),
  videoLinks: z.array(z.string()).default([]),
});

courseSubmissionsRouter.post(
  "/",
  requireAuth,
  requireTutor,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const tutor = await prisma.tutor.findUnique({
      where: { userId }
    });

    if (!tutor) {
      res.status(404).json({ message: "Tutor profile not found" });
      return;
    }

    const payloadResult = submissionSchema.safeParse(req.body);
    if (!payloadResult.success) {
      res.status(400).json({ 
        message: "Invalid submission data", 
        details: payloadResult.error.errors 
      });
      return;
    }
    
    const payload = payloadResult.data;

    // Enforce business logic matching the db check
    if (payload.priceLow > payload.priceHigh) {
      res.status(400).json({ message: "Lowest price cannot be greater than highest price" });
      return;
    }

    const submission = await prisma.courseSubmission.create({
      data: {
        tutorId: tutor.tutorId,
        courseName: payload.courseName,
        description: payload.description,
        targetAudience: payload.targetAudience,
        durationWeeks: payload.durationWeeks,
        category: payload.category,
        moduleCount: payload.moduleCount,
        priceHigh: payload.priceHigh,
        priceLow: payload.priceLow,
        discountPercent: payload.discountPercent,
        apiKeyEncrypted: payload.apiKeyEncrypted,
        apiKeyHint: payload.apiKeyHint,
        apiKeyProvider: payload.apiKeyProvider,
        // Since Prisma deals with JS objects mapped to JSON, we pass the parsed arrays directly
        uploadedDocuments: payload.uploadedDocuments,
        videoLinks: payload.videoLinks,
        status: "pending_review",
      }
    });

    res.status(201).json({
      message: "Course submission created successfully",
      submission
    });
  })
);

courseSubmissionsRouter.get(
  "/me",
  requireAuth,
  requireTutor,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const tutor = await prisma.tutor.findUnique({
      where: { userId }
    });

    if (!tutor) {
      res.status(404).json({ message: "Tutor profile not found" });
      return;
    }

    const submissions = await prisma.courseSubmission.findMany({
      where: { tutorId: tutor.tutorId },
      orderBy: { createdAt: "desc" }
    });

    res.json({ submissions });
  })
);

export { courseSubmissionsRouter };
