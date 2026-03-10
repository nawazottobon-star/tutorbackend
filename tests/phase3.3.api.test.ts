import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "../src/routes/auth";
import { tutorsRouter } from "../src/routes/tutors";
import { prisma } from "../src/services/prisma";

// Mock middleware
vi.mock("../src/middleware/requireAuth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
        req.auth = { userId: "test-tutor-id", role: "tutor" };
        next();
    },
}));

vi.mock("../src/middleware/requireRole", () => ({
    requireTutor: (req: any, res: any, next: any) => next(),
}));

// Mock Email and AI services
vi.mock("../src/services/emailService", () => ({ sendEmail: vi.fn() }));
vi.mock("../src/rag/openAiClient", () => ({
    generateTutorCopilotAnswer: vi.fn().mockResolvedValue("Mock AI response"),
    improveEmailMessage: vi.fn().mockResolvedValue("Mock improved message"),
}));

// Mock Chatbot Stats Service
vi.mock("../src/services/chatbot-stats.service", () => ({
    getChatbotSessionStats: vi.fn().mockResolvedValue([]),
    getQuestionTypeAnalysis: vi.fn().mockResolvedValue({}),
    getPerLearnerStats: vi.fn().mockResolvedValue([]),
    getLearnerCustomQuestions: vi.fn().mockResolvedValue([]),
    getModuleActivityOverview: vi.fn().mockResolvedValue([]),
}));

// Mock Security and Sessions
vi.mock("../src/shared/utils/password", () => ({
    verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("../src/services/sessionService", () => ({
    createSession: vi.fn().mockResolvedValue({
        accessToken: "mock-access",
        accessTokenExpiresAt: new Date(),
        refreshToken: "mock-refresh",
        refreshTokenExpiresAt: new Date(),
        sessionId: "mock-session",
    }),
    deleteSessionByRefreshToken: vi.fn().mockResolvedValue(undefined),
    renewSessionTokens: vi.fn().mockResolvedValue({
        accessToken: "mock-access-2",
        accessTokenExpiresAt: new Date(),
        refreshToken: "mock-refresh-2",
        refreshTokenExpiresAt: new Date(),
        sessionId: "mock-session-2",
    }),
}));

vi.mock("../src/services/googleOAuth", () => ({
    generateGoogleAuthUrl: vi.fn().mockReturnValue("https://mock-google-url"),
    exchangeCodeForTokens: vi.fn().mockResolvedValue({ profile: { email: "test@test.com", email_verified: true } }),
    verifyGoogleIdToken: vi.fn().mockResolvedValue({ email: "test@test.com", email_verified: true }),
}));

vi.mock("../src/services/userService", () => ({
    findOrCreateUserFromGoogle: vi.fn().mockResolvedValue({ userId: "mock-user-id", role: "learner" }),
}));

// Mock Prisma completely
vi.mock("../src/services/prisma", () => ({
    prisma: {
        user: { findUnique: vi.fn(), findMany: vi.fn() },
        courseTutor: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
        cohortMember: { findMany: vi.fn() },
        enrollment: { findMany: vi.fn() },
        cohort: { findMany: vi.fn() },
        topic: { findMany: vi.fn().mockResolvedValue([{ moduleNo: 1 }]), count: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _max: { moduleNo: 4 } }) },
        $queryRaw: vi.fn().mockResolvedValue([]),
    },
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRouter);
app.use("/tutors", tutorsRouter);

describe("Phase 3.3 Routes - Safety Net", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Auth Routes", () => {
        it("POST /auth/login should issue tokens for valid credentials", async () => {
            // @ts-ignore
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                userId: "tutor1", role: "tutor", passwordHash: "hash-password"
            });

            const res = await request(app).post("/auth/login").send({ email: "test@tutor.com", password: "password" });
            expect(res.status).toBe(200);
            expect(res.body.session.accessToken).toBe("mock-access");
        });

        it("GET /auth/google should redirect to Google OAuth URL", async () => {
            const res = await request(app).get("/auth/google");
            expect(res.status).toBe(302);
            expect(res.header.location).toBe("https://mock-google-url");
        });
    });

    describe("Tutor Routes", () => {
        it("GET /tutors/me/courses should return assigned courses", async () => {
            const mockCourses = [{ role: "owner", course: { courseId: "c1", courseName: "Test Course" } }];
            // @ts-ignore
            vi.mocked(prisma.courseTutor.findMany).mockResolvedValue(mockCourses);

            const res = await request(app).get("/tutors/me/courses");
            expect(res.status).toBe(200);
            expect(res.body.courses[0].title).toBe("Test Course");
        });

        it("GET /tutors/:courseId/progress should handle learner progress mapping gracefully", async () => {
            // @ts-ignore
            vi.mocked(prisma.courseTutor.findFirst).mockResolvedValue({ courseTutorId: "cx" });
            // @ts-ignore
            vi.mocked(prisma.enrollment.findMany).mockResolvedValue([{ userId: "u1", user: { fullName: "Test Learner", email: "test@l.com" }, enrolledAt: new Date() }]);

            const res = await request(app).get("/tutors/c1/progress");
            expect(res.status).toBe(200);
            expect(res.body.learners).toBeDefined();
        });
    });
});
