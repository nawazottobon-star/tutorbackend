import express from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { prisma } from "../services/prisma.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { requireTutor } from "../middleware/requireRole.js";
import { generateTutorCopilotAnswer, improveEmailMessage } from "../rag/openAiClient.js";
import { sendEmail } from "../services/emailService.js";
import { rateLimit } from "express-rate-limit";
import {
  getChatbotSessionStats,
  getQuestionTypeAnalysis,
  getPerLearnerStats,
  getLearnerCustomQuestions,
  getModuleActivityOverview,
} from "../services/chatbot-stats.service.js";
import {
  loginTutor,
  checkTutorHasCourses,
  getTutorCourses,
  isTutorForCourse,
} from "../services/tutorProfileService.js";
import {
  getCourseCohorts,
  getCourseEnrollments,
  getCourseProgressOverview,
} from "../services/tutorAnalyticsService.js";

export const tutorsRouter = express.Router();

const emailRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Too many email requests sent from this IP, please try again after a minute" },
  standardHeaders: true,
  legacyHeaders: false,
});

tutorsRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const result = await loginTutor(req.body?.email, req.body?.password);
    if (result.status === 200 && result.data) {
      res.status(200).json(result.data);
    } else {
      res.status(result.status).json({ message: result.message });
    }
  }),
);

tutorsRouter.get(
  "/me/has-courses",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const hasCourses = await checkTutorHasCourses(auth.userId);
    res.json({ hasCourses });
  }),
);

tutorsRouter.post(
  "/assistant/query",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const courseId = typeof req.body?.courseId === "string" ? req.body.courseId.trim() : "";
    const cohortId = typeof req.body?.cohortId === "string" ? req.body.cohortId.trim() : undefined;
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!courseId || !question) {
      res.status(400).json({ message: "courseId and question are required" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    try {
      const answer = await generateTutorCopilotAnswer({ question, courseId, cohortId, history });
      res.status(200).json({ answer });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Tutor assistant is unavailable right now.";
      res.status(500).json({ message });
    }
  }),
);

tutorsRouter.get(
  "/me/courses",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const courses = await getTutorCourses(auth.userId);
    res.status(200).json({ courses });
  }),
);

tutorsRouter.get(
  "/:courseId/enrollments",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;
    const format = typeof req.query.format === "string" ? req.query.format : undefined;
    const enrollments = await getCourseEnrollments(courseId, cohortId, format);
    res.status(200).json({ enrollments });
  }),
);

tutorsRouter.get(
  "/:courseId/cohorts",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    const cohorts = await getCourseCohorts(courseId);
    res.status(200).json({ cohorts });
  }),
);

tutorsRouter.get(
  "/:courseId/progress",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;
    const format = typeof req.query.format === "string" ? req.query.format : undefined;
    const stats = await getCourseProgressOverview(courseId, cohortId, format);
    res.status(200).json(stats);
  }),
);

tutorsRouter.post(
  "/email/improve",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { message, learnerName, courseName } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ message: "message is required and must be non-empty" });
      return;
    }

    const tutor = await prisma.user.findUnique({
      where: { userId: auth.userId },
      select: { fullName: true },
    });

    try {
      const improvedMessage = await improveEmailMessage({
        originalMessage: message.trim(),
        tutorName: tutor?.fullName || "Your Tutor",
        learnerName: learnerName || "the learner",
        courseName: courseName || "the course",
      });
      res.status(200).json({ improvedMessage });
    } catch {
      res.status(500).json({ message: "AI improvement service is temporarily unavailable. Please try again." });
    }
  }),
);

tutorsRouter.post(
  "/email",
  requireAuth,
  requireTutor,
  emailRateLimiter,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { to, subject, message } = req.body;
    if (!to || !subject || !message) {
      res.status(400).json({ message: "to, subject, and message are required" });
      return;
    }

    const tutor = await prisma.user.findUnique({
      where: { userId: auth.userId },
      select: { email: true, fullName: true },
    });

    if (!tutor) {
      res.status(404).json({ message: "Tutor not found" });
      return;
    }

    try {
      await sendEmail({
        to,
        subject,
        text: message,
        replyTo: tutor.email,
        fromName: tutor.fullName || "Tutor",
      });
      res.status(200).json({ message: "Email sent successfully" });
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to send email. Please check your email credentials or try again later.",
        details: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }),
);

tutorsRouter.get(
  "/:courseId/chatbot-stats",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;
    const learnerId = typeof req.query.learnerId === "string" ? req.query.learnerId : undefined;

    try {
      const stats = await getChatbotSessionStats(courseId, cohortId, learnerId);
      res.status(200).json({ stats });
    } catch {
      res.status(500).json({ message: "Failed to fetch chatbot statistics" });
    }
  }),
);

tutorsRouter.get(
  "/:courseId/question-analysis",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;
    const learnerId = typeof req.query.learnerId === "string" ? req.query.learnerId : undefined;
    const topicId = typeof req.query.topicId === "string" ? req.query.topicId : undefined;

    try {
      const analysis = await getQuestionTypeAnalysis(courseId, cohortId, learnerId, topicId);
      res.status(200).json({ analysis });
    } catch {
      res.status(500).json({ message: "Failed to fetch question analysis" });
    }
  }),
);

tutorsRouter.get(
  "/:courseId/chatbot-stats/learners",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;

    try {
      const learners = await getPerLearnerStats(courseId, cohortId);
      res.status(200).json({ learners });
    } catch {
      res.status(500).json({ message: "Failed to fetch per-learner statistics" });
    }
  }),
);

tutorsRouter.get(
  "/:courseId/chatbot-stats/learners/:learnerId/custom-questions",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { courseId, learnerId } = req.params;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;

    try {
      const questions = await getLearnerCustomQuestions(courseId, learnerId, cohortId);
      res.status(200).json({ questions });
    } catch {
      res.status(500).json({ message: "Failed to fetch custom questions" });
    }
  }),
);

tutorsRouter.get(
  "/:courseId/chatbot-stats/modules",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;

    try {
      const modules = await getModuleActivityOverview(courseId, cohortId);
      res.status(200).json({ modules });
    } catch {
      res.status(500).json({ message: "Failed to fetch module overview" });
    }
  }),
);
