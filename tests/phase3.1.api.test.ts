import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { pagesRouter } from "../src/routes/pages";
import { usersRouter } from "../src/routes/users";
import { publicWorkshopsRouter } from "../src/routes/publicWorkshops";
import { prisma } from "../src/services/prisma";

// Mock the entire Prisma client so no database is ever touched
vi.mock("../src/services/prisma", () => ({
    prisma: {
        pageContent: { findUnique: vi.fn() },
        user: { findUnique: vi.fn() },
        assessmentQuestion: { findMany: vi.fn() },
        registration: { create: vi.fn() },
    },
}));

// Setup Express app specifically for testing without starting the full server
const app = express();
app.use(express.json());

// Mock requireAuth middleware for the users route to bypass real JWT checks
vi.mock("../src/middleware/requireAuth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
        // Inject a dummy authenticated user
        req.auth = { userId: "test-user-id", role: "learner" };
        next();
    },
}));

// Mount the routers just like the real app does
app.use("/api/pages", pagesRouter);
app.use("/api/users", usersRouter);
app.use("/api/public/workshops", publicWorkshopsRouter);

describe("Phase 3.1 Routes - Safety Net", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("GET /api/pages/:slug", () => {
        it("should return 404 if page not found", async () => {
            vi.mocked(prisma.pageContent.findUnique).mockResolvedValue(null);

            const res = await request(app).get("/api/pages/unknown-slug");
            expect(res.status).toBe(404);
            expect(res.body.message).toBe("Page not found");
        });

        it("should return the page content if found", async () => {
            const mockPage = {
                slug: "about",
                title: "About Us",
                subtitle: null,
                heroImage: null,
                sections: [],
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            };

            // @ts-ignore - Mocking just the necessary fields
            vi.mocked(prisma.pageContent.findUnique).mockResolvedValue(mockPage);

            const res = await request(app).get("/api/pages/about");
            expect(res.status).toBe(200);
            expect(res.body.page.slug).toBe("about");
            expect(res.body.page.updatedAt).toBe(mockPage.updatedAt.toISOString());
        });
    });

    describe("GET /api/users/me", () => {
        it("should return 404 if the authenticated user is not in the DB", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            const res = await request(app).get("/api/users/me");
            expect(res.status).toBe(404);
        });

        it("should return user details when found", async () => {
            const mockUser = {
                userId: "test-user-id",
                email: "test@example.com",
                fullName: "Test User",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
            };

            // @ts-ignore
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

            const res = await request(app).get("/api/users/me");
            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe("test@example.com");
        });
    });

    describe("Public Workshops Routes", () => {
        it("GET /api/public/workshops/:id/questions should return questions", async () => {
            const mockQuestions = [{ questionId: "q1", text: "Test Q" }];
            // @ts-ignore
            vi.mocked(prisma.assessmentQuestion.findMany).mockResolvedValue(mockQuestions);

            const res = await request(app).get("/api/public/workshops/offer123/questions");
            expect(res.status).toBe(200);
            expect(res.body.questions.length).toBe(1);
        });

        it("POST /api/public/workshops/:id/register should create registration", async () => {
            // @ts-ignore
            vi.mocked(prisma.registration.create).mockResolvedValue({ registrationId: "reg123" });

            const res = await request(app).post("/api/public/workshops/offer123/register").send({
                fullName: "John Doe",
                email: "john@doe.com"
            });

            expect(res.status).toBe(201);
            expect(res.body.registrationId).toBe("reg123");
            // Guarantee database was never genuinely hit
            expect(prisma.registration.create).toHaveBeenCalledTimes(1);
        });
    });
});
