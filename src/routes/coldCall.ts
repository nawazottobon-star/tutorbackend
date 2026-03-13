import express from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { prisma } from "../services/prisma.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export const coldCallRouter = express.Router();

// Helper to get tutor from auth
const getTutor = async (userId: string) => {
    return await prisma.tutor.findUnique({
        where: { userId },
    });
};

/**
 * GET /overview/:courseId
 * Returns all topics for a course and their current active cold call prompts.
 */
coldCallRouter.get(
    "/overview/:courseId",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth!.userId);

        if (!tutor) {
            res.status(403).json({ message: "Access denied: Tutors only." });
            return;
        }

        // Verify course ownership
        const courseOwnership = await prisma.courseTutor.findUnique({
            where: {
                courseId_tutorId: {
                    courseId,
                    tutorId: tutor.tutorId
                }
            }
        });

        if (!courseOwnership) {
            res.status(403).json({ message: "You do not have management rights for this course." });
            return;
        }

        const topics = await prisma.topic.findMany({
            where: { courseId },
            orderBy: [
                { moduleNo: 'asc' },
                { topicNumber: 'asc' }
            ],
            include: {
                coldCallPrompts: {
                    where: { isActive: true },
                    take: 1
                }
            }
        });

        const overview = topics.map(topic => ({
            topicId: topic.topicId,
            moduleNo: topic.moduleNo,
            moduleName: topic.moduleName,
            topicNumber: topic.topicNumber,
            topicName: topic.topicName,
            activePrompt: topic.coldCallPrompts[0] || null
        }));

        res.status(200).json({ topics: overview });
    })
);

/**
 * POST /update
 * Deactivates existing prompt and creates a new one (Append-Only logic).
 */
coldCallRouter.post(
    "/update",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { topicId, promptText, helperText } = req.body;
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth!.userId);

        if (!tutor || !topicId || !promptText) {
            res.status(400).json({ message: "Missing required fields or unauthorized." });
            return;
        }

        const topic = await prisma.topic.findUnique({
            where: { topicId },
            select: { courseId: true }
        });

        if (!topic) {
            res.status(404).json({ message: "Topic not found." });
            return;
        }

        // Verify ownership
        const ownership = await prisma.courseTutor.findUnique({
            where: {
                courseId_tutorId: {
                    courseId: topic.courseId,
                    tutorId: tutor.tutorId
                }
            }
        });

        if (!ownership) {
            res.status(403).json({ message: "Unauthorized." });
            return;
        }

        // 1. Transaction to handle deactivation and creation safely
        try {
            const newPrompt = await prisma.$transaction(async (tx) => {
                // Deactivate current active prompt for this topic
                await tx.coldCallPrompt.updateMany({
                    where: { topicId, isActive: true },
                    data: { isActive: false }
                });

                // Find the highest displayOrder to satisfy uniqueness constraint [topicId, displayOrder]
                const lastPrompt = await tx.coldCallPrompt.findFirst({
                    where: { topicId },
                    orderBy: { displayOrder: "desc" },
                    select: { displayOrder: true }
                });

                const nextOrder = (lastPrompt?.displayOrder ?? -1) + 1;

                // Create new prompt
                return await tx.coldCallPrompt.create({
                    data: {
                        courseId: topic.courseId,
                        topicId: topicId,
                        promptText: promptText.trim(),
                        helperText: helperText || "You will see your batchmates responses only after you submit your own answer.",
                        isActive: true,
                        displayOrder: nextOrder
                    }
                });
            });

            res.status(201).json({ 
                message: "Question published successfully.", 
                prompt: newPrompt 
            });
        } catch (error: any) {
            console.error("ColdCall Update Error:", error);
            res.status(500).json({ 
                message: "Failed to publish question.", 
                error: error.message 
            });
        }
    })
);

/**
 * GET /responses/:topicId
 * Fetches learner responses grouped by cohort.
 */
coldCallRouter.get(
    "/responses/:topicId",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { topicId } = req.params;
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth!.userId);

        if (!tutor) {
            res.status(403).json({ message: "Unauthorized." });
            return;
        }

        // Find all cohorts for this course
        const topic = await prisma.topic.findUnique({ where: { topicId } });
        if (!topic) {
            res.status(404).json({ message: "Topic not found." });
            return;
        }

        const messages = await prisma.coldCallMessage.findMany({
            where: { 
                prompt: { topicId: topicId },
                status: 'active'
            },
            include: {
                user: { select: { fullName: true, email: true } },
                cohort: { select: { name: true } },
                prompt: { select: { promptId: true, promptText: true, createdAt: true } },
                _count: { select: { stars: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ responses: messages });
    })
);

/**
 * GET /prompts/:topicId/history
 * Fetches all prompt history for a topic (TUTOR ONLY).
 */
coldCallRouter.get(
    "/prompts/:topicId/history",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { topicId } = req.params;
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth!.userId);

        if (!tutor) {
            res.status(403).json({ message: "Unauthorized." });
            return;
        }

        const topic = await prisma.topic.findUnique({ where: { topicId } });
        if (!topic) {
            res.status(404).json({ message: "Topic not found." });
            return;
        }

        const prompts = await prisma.coldCallPrompt.findMany({
            where: { topicId },
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: { messages: { where: { status: 'active' } } }
                }
            }
        });
        res.status(200).json({ prompts });
    })
);

/**
 * GET /prompts/:topicId
 * Fetches the currently ACTIVE prompt for a topic (Learner & Tutor).
 */
coldCallRouter.get(
    "/prompts/:topicId",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { topicId } = req.params;
        const auth = (req as AuthenticatedRequest).auth;
        
        // Find the active prompt
        const prompt = await prisma.coldCallPrompt.findFirst({
            where: { topicId, isActive: true },
            orderBy: { createdAt: "desc" }
        });

        if (!prompt) {
            res.status(404).json({ message: "No active cold calling prompt found for this topic." });
            return;
        }

        // Check if user is a member of any cohort for this course
        const membership = await prisma.cohortMember.findFirst({
            where: { 
                userId: auth!.userId,
                cohort: { courseId: prompt.courseId }
            },
            include: { cohort: true }
        });

        if (!membership) {
            // If they aren't a member, check if they are the tutor
            const tutor = await getTutor(auth!.userId);
            const ownership = tutor ? await prisma.courseTutor.findUnique({
                where: { courseId_tutorId: { courseId: prompt.courseId, tutorId: tutor.tutorId } }
            }) : null;

            if (!ownership) {
                res.status(403).json({ message: "Cohort access required to participate." });
                return;
            }
            
            // For tutors, return the prompt without messages or with all messages?
            // Tutors usually use the /responses endpoint, but let's return a safe mock cohort.
            res.status(200).json({
                prompt,
                cohort: { cohortId: "tutor-view", name: "Management View" },
                hasSubmitted: true,
                messages: []
            });
            return;
        }

        // For learners, check if they've already submitted
        const myMessage = await prisma.coldCallMessage.findFirst({
            where: { promptId: prompt.promptId, userId: auth!.userId, status: 'active' }
        });

        const hasSubmitted = !!myMessage;

        // Fetch cohort messages if they've submitted
        let messages: any[] = [];
        if (hasSubmitted) {
            messages = await prisma.coldCallMessage.findMany({
                where: { 
                    promptId: prompt.promptId, 
                    cohortId: membership.cohortId,
                    status: 'active'
                },
                include: {
                    user: { select: { userId: true, fullName: true } },
                    stars: { where: { userId: auth!.userId } },
                    _count: { select: { stars: true } }
                },
                orderBy: { createdAt: "desc" }
            });

            // Map messages to format expected by ColdCalling component
            messages = messages.map(m => ({
                messageId: m.messageId,
                body: m.body,
                parentId: m.parentId,
                rootId: m.rootId,
                createdAt: m.createdAt.toISOString(),
                user: m.user,
                starCount: m._count.stars,
                starredByMe: m.stars.length > 0
            }));
        }

        res.status(200).json({
            prompt,
            cohort: { cohortId: membership.cohortId, name: membership.cohort.name },
            hasSubmitted,
            messages
        });
    })
);

/**
 * POST /messages
 * Submit a new response to a prompt.
 */
coldCallRouter.post(
    "/messages",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { promptId, body } = req.body;
        const auth = (req as AuthenticatedRequest).auth;

        const prompt = await prisma.coldCallPrompt.findUnique({ where: { promptId } });
        if (!prompt) {
            res.status(404).json({ message: "Prompt not found." });
            return;
        }

        const membership = await prisma.cohortMember.findFirst({
            where: { userId: auth!.userId, cohort: { courseId: prompt.courseId } }
        });

        if (!membership) {
            res.status(403).json({ message: "Must be enrolled in a cohort to participate." });
            return;
        }

        const message = await prisma.coldCallMessage.create({
            data: {
                promptId,
                cohortId: membership.cohortId,
                userId: auth!.userId,
                body,
                status: 'active'
            }
        });

        res.status(201).json({ message: "Response submitted.", data: message });
    })
);

/**
 * POST /replies
 * Submit a reply to an existing message.
 */
coldCallRouter.post(
    "/replies",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { parentId, body } = req.body;
        const auth = (req as AuthenticatedRequest).auth;

        const parent = await prisma.coldCallMessage.findUnique({ 
            where: { messageId: parentId },
            include: { prompt: true }
        });

        if (!parent) {
            res.status(404).json({ message: "Message not found." });
            return;
        }

        const membership = await prisma.cohortMember.findFirst({
            where: { userId: auth!.userId, cohort: { courseId: parent.prompt.courseId } }
        });

        if (!membership) {
            res.status(403).json({ message: "Access denied." });
            return;
        }

        const reply = await prisma.coldCallMessage.create({
            data: {
                promptId: parent.promptId,
                cohortId: membership.cohortId,
                userId: auth!.userId,
                parentId: parentId,
                rootId: parent.rootId || parentId,
                body,
                status: 'active'
            }
        });

        res.status(201).json({ message: "Reply posted.", data: reply });
    })
);

/**
 * POST /stars
 * Star a message.
 */
coldCallRouter.post(
    "/stars",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { messageId } = req.body;
        const auth = (req as AuthenticatedRequest).auth;

        await prisma.coldCallStar.upsert({
            where: { messageId_userId: { messageId, userId: auth!.userId } },
            create: { messageId, userId: auth!.userId },
            update: {}
        });

        res.status(200).json({ message: "Starred." });
    })
);

/**
 * DELETE /stars/:messageId
 * Unstar a message.
 */
coldCallRouter.delete(
    "/stars/:messageId",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { messageId } = req.params;
        const auth = (req as AuthenticatedRequest).auth;

        await prisma.coldCallStar.deleteMany({
            where: { messageId, userId: auth!.userId }
        });

        res.status(204).send();
    })
);
