import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { coursesRouter } from "../src/routes/courses";
import { adminRouter } from "../src/routes/admin";
import { lessonsRouter } from "../src/routes/lessons";
import { prisma } from "../src/services/prisma";

// Mock middleware
vi.mock("../src/middleware/requireAuth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
        req.auth = { userId: "test-user-id", role: "admin" };
        next();
    },
}));

vi.mock("../src/middleware/requireRole", () => ({
    requireAdmin: (req: any, res: any, next: any) => next(),
}));

// Mock Cohort & Enrollment logic
vi.mock("../src/services/enrollmentService", () => ({
    ensureEnrollment: vi.fn().mockResolvedValue(true),
}));

vi.mock("../src/services/cohortAccess", () => ({
    checkCohortAccessForUser: vi.fn().mockResolvedValue({ allowed: true, status: 200 }),
}));


// Mock the entire Prisma client
vi.mock("../src/services/prisma", () => ({
    prisma: {
        course: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
        tutorApplication: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        user: { upsert: vi.fn() },
        tutor: { upsert: vi.fn() },
        courseTutor: { upsert: vi.fn() },
        topic: { findMany: vi.fn(), findUnique: vi.fn() },
        topicProgress: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    },
}));

const app = express();
app.use(express.json());
app.use("/api/courses", coursesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/lessons", lessonsRouter);

describe("Phase 3.2 Routes - Safety Net", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Courses Routes", () => {
        it("GET /api/courses should return mapped courses", async () => {
            const mockCourses = [{
                courseId: "c1",
                courseName: "Test Course",
                description: "Desc",
                priceCents: 1000,
                slug: "test-course",
                createdAt: new Date("2026-01-01T00:00:00Z"),
            }];
            // @ts-ignore
            vi.mocked(prisma.course.findMany).mockResolvedValue(mockCourses);

            const res = await request(app).get("/api/courses");
            expect(res.status).toBe(200);
            expect(res.body.courses[0].price).toBe(10); // Price cents mapping works
            expect(res.body.courses[0].slug).toBe("test-course");
        });
    });

    describe("Admin Routes", () => {
        it("GET /api/admin/tutor-applications should return apps", async () => {
            const mockApps = [{ applicationId: "app1", fullName: "John" }];
            // @ts-ignore
            vi.mocked(prisma.tutorApplication.findMany).mockResolvedValue(mockApps);

            const res = await request(app).get("/api/admin/tutor-applications");
            expect(res.status).toBe(200);
            expect(res.body.applications[0].applicationId).toBe("app1");
        });
    });

    describe("Lessons Routes", () => {
        it("GET /api/lessons/modules/:no/topics should return topics", async () => {
            const mockTopics = [{
                topicId: "t1", courseId: "c1", moduleNo: 1, topicNumber: 1, topicName: "Intro",
                videoUrl: "https://youtube.com/watch?v=123"
            }];
            // @ts-ignore
            vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics);

            const res = await request(app).get("/api/lessons/modules/1/topics");
            expect(res.status).toBe(200);
            expect(res.body.topics[0].videoUrl).toContain("embed/123"); // Video normalization works
        });
    });
});
