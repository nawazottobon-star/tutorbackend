import express from "express";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../shared/utils/asyncHandler";
import { prisma } from "../services/prisma";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTutor } from "../middleware/requireRole";
import { verifyPassword } from "../shared/utils/password";
import { createSession } from "../services/sessionService";
import { buildTutorCourseSnapshot, formatTutorSnapshot } from "../services/tutorInsights";
import { generateTutorCopilotAnswer, improveEmailMessage } from "../rag/openAiClient";
import { sendEmail } from "../services/emailService";
import { rateLimit } from "express-rate-limit";
import { getChatbotSessionStats, getQuestionTypeAnalysis, getPerLearnerStats, getLearnerCustomQuestions, getModuleActivityOverview } from "../services/chatbot-stats.service";

const tutorsRouter = express.Router();

const emailRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { message: "Too many email requests sent from this IP, please try again after a minute" },
  standardHeaders: true,
  legacyHeaders: false,
});

async function isTutorForCourse(userId: string, courseId: string): Promise<boolean> {
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

tutorsRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
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
      res.status(403).json({ message: "Tutor account required" });
      return;
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ message: "Wrong email or wrong password" });
      return;
    }

    const tokens = await createSession(user.userId, user.role);

    res.status(200).json({
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
    });
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

    if (!courseId) {
      res.status(400).json({ message: "courseId is required" });
      return;
    }
    if (!question) {
      res.status(400).json({ message: "question is required" });
      return;
    }

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    try {
      // Call the new function-based chatbot
      const answer = await generateTutorCopilotAnswer({
        question,
        courseId,
        cohortId,
        history,
      });

      res.status(200).json({ answer });
    } catch (error) {
      console.error("Tutor assistant query failed", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Tutor assistant is unavailable right now. Please try again.";
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

    const courses = await prisma.courseTutor.findMany({
      where: {
        isActive: true,
        tutor: { userId: auth.userId },
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

    res.status(200).json({
      courses: courses.map((entry) => ({
        courseId: entry.course.courseId,
        slug: entry.course.slug,
        title: entry.course.courseName,
        description: entry.course.description,
        role: entry.role,
      })),
    });
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

    if (cohortId) {
      const members = await prisma.cohortMember.findMany({
        where: { cohortId },
        include: {
          user: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: { addedAt: "desc" },
      });

      res.status(200).json({
        enrollments: members.map((member) => {
          // If user exists, use their full name
          // Otherwise, create a readable name from email prefix
          let displayName = "Learner";
          if (member.user?.fullName) {
            displayName = member.user.fullName;
          } else {
            // Extract email prefix and capitalize first letter
            const emailPrefix = member.email.split('@')[0];
            displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
          }

          return {
            enrollmentId: member.memberId,
            enrolledAt: member.addedAt,
            status: member.status,
            userId: member.userId,
            fullName: displayName,
            email: member.email,
          };
        }),
      });
      return;
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

    res.status(200).json({
      enrollments: enrollments.map((enrollment) => ({
        enrollmentId: enrollment.enrollmentId,
        enrolledAt: enrollment.enrolledAt,
        status: enrollment.status,
        userId: enrollment.user.userId,
        fullName: enrollment.user.fullName,
        email: enrollment.user.email,
      })),
    });
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

    const cohorts = await prisma.cohort.findMany({
      where: { courseId },
      orderBy: [
        { startsAt: "desc" },
        { createdAt: "desc" },
      ],
    });


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

    const moduleNumbers = await prisma.topic.findMany({
      where: { courseId: courseId as string, moduleNo: { gt: 0 } },
      select: { moduleNo: true },
      distinct: ["moduleNo"],
      orderBy: { moduleNo: "asc" },
    });
    let totalModules = moduleNumbers.length;

    // Fallback: if no moduleNo > 0, check if there are any topics at all
    if (totalModules === 0) {
      const allTopics = await prisma.topic.count({ where: { courseId: courseId as string } });
      if (allTopics > 0) {
        // If there are topics but they don't have moduleNo > 0, maybe they are all module 0?
        // Or maybe moduleNo is used differently. Let's just use the max moduleNo if available.
        const maxModule = await prisma.topic.aggregate({
          where: { courseId: courseId as string },
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
      targetUsers = members.map(m => {
        let displayName = "Learner";
        if (m.user?.fullName) {
          displayName = m.user.fullName;
        } else {
          const emailPrefix = m.email.split('@')[0];
          displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        }

        return {
          userId: m.userId,
          email: m.email,
          fullName: displayName,
          enrolledAt: m.addedAt.toISOString()
        };
      });
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        include: { user: { select: { fullName: true, email: true } } },
      });
      targetUsers = enrollments.map(e => ({
        userId: e.userId,
        email: e.user.email,
        fullName: e.user.fullName || e.user.email.split('@')[0] || "Learner",
        enrolledAt: e.enrolledAt.toISOString()
      }));
    }

    // Since progress is stored by userId, we can only fetch it for members with a userId
    const userIdsWithProgress = targetUsers
      .map(u => u.userId)
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
      } catch (error) {
        console.error("Failed to fetch progress rows:", error);
        // Continue without progress rows so at least the list shows up
      }
    }

    const progressByUser = new Map<string, { passedModules: Set<number> }>();
    progressRows.forEach((row) => {
      if (!row.quiz_passed) {
        return;
      }
      const entry = progressByUser.get(row.user_id) ?? { passedModules: new Set<number>() };
      entry.passedModules.add(row.module_no);
      progressByUser.set(row.user_id, entry);
    });

    const learners = targetUsers.map((user) => {
      const progress = user.userId ? progressByUser.get(user.userId) : null;
      const completedCount = progress ? progress.passedModules.size : 0;
      const percent = totalModules === 0 ? 0 : Math.min(100, Math.floor((completedCount / totalModules) * 100));
      return {
        userId: user.userId || `temp-${user.email}`, // Fallback for key
        fullName: user.fullName,
        email: user.email,
        enrolledAt: user.enrolledAt,
        completedModules: completedCount,
        totalModules,
        percent,
      };
    });

    res.status(200).json({ learners, totalModules });
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

    // Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ message: "message is required and must be non-empty" });
      return;
    }

    // Optional context (will use defaults if not provided)
    const learner = learnerName || "the learner";
    const course = courseName || "the course";

    // READ-ONLY: Fetch tutor name for personalization
    const tutor = await prisma.user.findUnique({
      where: { userId: auth.userId },
      select: { fullName: true },
    });

    const tutorName = tutor?.fullName || "Your Tutor";

    try {
      // Call AI service to improve message
      const improvedMessage = await improveEmailMessage({
        originalMessage: message.trim(),
        tutorName,
        learnerName: learner,
        courseName: course,
      });

      res.status(200).json({ improvedMessage });
    } catch (error) {
      console.error("Failed to improve email message:", error);
      res.status(500).json({
        message: "AI improvement service is temporarily unavailable. Please try again."
      });
    }
  })
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

    // Fetch tutor email and name for Reply-To and From headers
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
        to: to,
        subject: subject,
        text: message,
        replyTo: tutor.email,
        fromName: tutor.fullName || "Tutor",
      });

      console.log(`[EMAIL SENT] From: ${tutor.email}, To: ${to}, Subject: ${subject}`);
      res.status(200).json({ message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Failed to send email:", error);
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({
        message: "Failed to send email. Please check your email credentials or try again later.",
        details: errorMessage
      });
    }
  }),
);

// GET /tutors/:courseId/chatbot-stats
// Returns chatbot session statistics per topic/module
// Supports cohort filtering via ?cohortId=xxx
// Supports individual learner via ?learnerId=xxx
tutorsRouter.get(
  "/:courseId/chatbot-stats",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    console.log('[Chatbot Stats] Request received:', {
      courseId: req.params.courseId,
      hasAuth: Boolean((req as AuthenticatedRequest).auth),
      cookies: Object.keys(req.cookies || {}),
      query: req.query
    });

    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;

    if (!auth) {
      console.log('[Chatbot Stats] No auth found - returning 401');
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    console.log('[Chatbot Stats] Auth found:', { userId: auth.userId, role: auth.role });

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      console.log('[Chatbot Stats] Tutor not assigned to course - returning 403');
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    console.log('[Chatbot Stats] Authorization passed, fetching stats');

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;
    const learnerId = typeof req.query.learnerId === "string" ? req.query.learnerId : undefined;

    try {
      const stats = await getChatbotSessionStats(courseId, cohortId, learnerId);
      console.log('[Chatbot Stats] Stats fetched successfully:', { count: stats.length });
      res.status(200).json({ stats });
    } catch (error) {
      console.error("Failed to fetch chatbot stats:", error);
      res.status(500).json({ message: "Failed to fetch chatbot statistics" });
    }
  }),
);

// GET /tutors/:courseId/question-analysis
// Returns question type analysis (predefined vs custom)
// Supports cohort filtering via ?cohortId=xxx
// Supports individual learner via ?learnerId=xxx
// Supports topic filtering via ?topicId=xxx
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
    } catch (error) {
      console.error("Failed to fetch question analysis:", error);
      res.status(500).json({ message: "Failed to fetch question analysis" });
    }
  }),
);

// GET /tutors/:courseId/chatbot-stats/learners
// Returns per-learner chatbot statistics
// Supports cohort filtering via ?cohortId=xxx
tutorsRouter.get(
  "/:courseId/chatbot-stats/learners",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    console.log('[Per-Learner Stats] Request received:', {
      courseId: req.params.courseId,
      hasAuth: Boolean((req as AuthenticatedRequest).auth),
      query: req.query
    });

    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;

    if (!auth) {
      console.log('[Per-Learner Stats] No auth found - returning 401');
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    console.log('[Per-Learner Stats] Auth found:', { userId: auth.userId, role: auth.role });

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      console.log('[Per-Learner Stats] Tutor not assigned to course - returning 403');
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    console.log('[Per-Learner Stats] Authorization passed, fetching stats');

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;

    try {
      const learners = await getPerLearnerStats(courseId, cohortId);
      console.log('[Per-Learner Stats] Stats fetched successfully:', { count: learners.length });
      res.status(200).json({ learners });
    } catch (error) {
      console.error("Failed to fetch per-learner stats:", error);
      res.status(500).json({ message: "Failed to fetch per-learner statistics" });
    }
  }),
);

// GET /tutors/:courseId/chatbot-stats/learners/:learnerId/custom-questions
// Returns custom questions asked by a specific learner
// Supports cohort filtering via ?cohortId=xxx
tutorsRouter.get(
  "/:courseId/chatbot-stats/learners/:learnerId/custom-questions",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    console.log('[Custom Questions] Request received:', {
      courseId: req.params.courseId,
      learnerId: req.params.learnerId,
      hasAuth: Boolean((req as AuthenticatedRequest).auth),
      query: req.query
    });

    const auth = (req as AuthenticatedRequest).auth;
    const { courseId, learnerId } = req.params;

    if (!auth) {
      console.log('[Custom Questions] No auth found - returning 401');
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    console.log('[Custom Questions] Auth found:', { userId: auth.userId, role: auth.role });

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      console.log('[Custom Questions] Tutor not assigned to course - returning 403');
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    console.log('[Custom Questions] Authorization passed, fetching questions');

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;

    try {
      const questions = await getLearnerCustomQuestions(courseId, learnerId, cohortId);
      console.log('[Custom Questions] Questions fetched successfully:', { count: questions.length });
      res.status(200).json({ questions });
    } catch (error) {
      console.error("Failed to fetch custom questions:", error);
      res.status(500).json({ message: "Failed to fetch custom questions" });
    }
  }),
);

// GET /tutors/:courseId/chatbot-stats/modules
// Returns module activity overview
// Supports cohort filtering via ?cohortId=xxx
tutorsRouter.get(
  "/:courseId/chatbot-stats/modules",
  requireAuth,
  requireTutor,
  asyncHandler(async (req, res) => {
    console.log('[Module Overview] Request received:', {
      courseId: req.params.courseId,
      hasAuth: Boolean((req as AuthenticatedRequest).auth),
      query: req.query
    });

    const auth = (req as AuthenticatedRequest).auth;
    const { courseId } = req.params;

    if (!auth) {
      console.log('[Module Overview] No auth found - returning 401');
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    console.log('[Module Overview] Auth found:', { userId: auth.userId, role: auth.role });

    const allowed = await isTutorForCourse(auth.userId, courseId);
    if (!allowed) {
      console.log('[Module Overview] Tutor not assigned to course - returning 403');
      res.status(403).json({ message: "Tutor is not assigned to this course" });
      return;
    }

    console.log('[Module Overview] Authorization passed, fetching overview');

    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : undefined;

    try {
      const modules = await getModuleActivityOverview(courseId, cohortId);
      console.log('[Module Overview] Overview fetched successfully:', { count: modules.length });
      res.status(200).json({ modules });
    } catch (error) {
      console.error("Failed to fetch module overview:", error);
      res.status(500).json({ message: "Failed to fetch module overview" });
    }
  }),
);

export { tutorsRouter };
