import express from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

const tutorApplicationsRouter = express.Router();

const tutorApplicationSchema = z.object({
  // Step 1: Who You Are
  fullName: z.string().min(2, "Full name required").max(200),
  email: z.string().email("Invalid email").max(320),
  phone: z.string().min(8, "Phone number too short").max(30).optional().nullable(),
  city: z.string().min(2, "City required").max(200).optional().nullable(),
  timezone: z.string().min(2, "Timezone required").max(100).optional().nullable(),

  // Step 2: Your Expertise
  expertise_streams: z.array(z.string()).min(1, "Select at least one stream").optional(),
  expertise_other_text: z.string().max(200).optional().nullable(),
  years_of_experience: z.coerce.number().int().min(0).max(60).optional().nullable(),
  linkedin_url: z.string().url("Invalid LinkedIn URL").max(500).or(z.literal("")).optional().nullable(),
  bio: z.string().min(1, "Bio required").max(600).optional().nullable(),

  // Step 3: Your Course Idea
  courseTitle: z.string().max(200).optional(),
  course_title: z.string().min(1, "Title required").max(200).optional(), 
  availability: z.string().min(2, "Availability required").max(200),
  teaching_formats: z.array(z.string()).min(1, "Select at least one format").optional(),
  courseDescription: z.string().max(8000).optional(),
  course_description: z.string().min(1, "Description required").max(8000).optional(),
  targetAudience: z.string().max(2000).optional(),
  target_audience: z.string().min(1, "Target audience required").max(2000).optional(),

  // Step 4: How You'll Earn
  payment_model: z.string().optional().nullable(),
  payout_method: z.string().optional().nullable(),
  agreed_to_terms: z.boolean().refine(v => v === true, "Must agree to terms"),

  // Legacy fields (optional)
  headline: z.string().max(240).optional().nullable(),
  expertiseArea: z.string().max(200).optional().nullable(),
  experienceYears: z.coerce.number().optional().nullable(),
});

tutorApplicationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const result = tutorApplicationSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid tutor application data",
        errors: result.error.flatten(),
      });
      return;
    }

    const data = result.data;

    // Transformation Logic
    const finalFullName = data.fullName || "Applicant";
    const finalExpertiseStreams = data.expertise_streams || [];
    const finalExpertiseArea = 
      data.expertiseArea || 
      (finalExpertiseStreams.length > 0 ? finalExpertiseStreams[0] : "General");
    
    // Coerce numeric fields
    const finalExperienceYears = data.years_of_experience ?? data.experienceYears ?? null;

    const application = await prisma.tutorApplication.create({
      data: {
        fullName: finalFullName,
        email: data.email.toLowerCase().trim(),
        phone: data.phone || null,
        city: data.city || null,
        timezone: data.timezone || null,
        headline: data.headline || `${finalExpertiseArea} Expert`,
        expertiseArea: finalExpertiseArea,
        expertiseStreams: finalExpertiseStreams,
        expertiseOther: data.expertise_other_text || null,
        experienceYears: finalExperienceYears,
        linkedinUrl: data.linkedin_url || null,
        bio: data.bio || null,
        courseTitle: data.course_title || data.courseTitle || "Untitled Course",
        courseDescription: data.course_description || data.courseDescription || "No description provided.",
        targetAudience: data.target_audience || data.targetAudience || "General learners",
        availability: data.availability,
        teachingFormats: data.teaching_formats || [],
        paymentModel: data.payment_model || null,
        payoutMethod: data.payout_method || null,
        status: "pending",
      },
    });

    res.status(201).json({
      message: "Application submitted successfully",
      application: {
        id: application.applicationId,
        status: application.status,
        submittedAt: application.createdAt,
      },
    });
  }),
);

export { tutorApplicationsRouter };
