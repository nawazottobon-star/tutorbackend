import { Router } from "express";
import { asyncHandler } from "../shared/utils/asyncHandler";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { getLatestStatusesForCourse, getLearnerHistory, ensureTutorOrAdminAccess } from "../services/activityEventService";

const router = Router();

/**
 * GET /activity/courses/:courseId/learners
 * Returns the latest status for all learners in a specific course.
 */
router.get(
    "/courses/:courseId/learners",
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
        const { courseId } = req.params;
        const { cohortId } = req.query as { cohortId?: string };
        const { userId, role } = req.auth!;

        // Ensure user has access to this course's telemetry
        await ensureTutorOrAdminAccess(userId, courseId, role);

        const learners = await getLatestStatusesForCourse(courseId, cohortId);

        // Calculate summary
        const summary = {
            engaged: 0,
            attention_drift: 0,
            content_friction: 0,
            unknown: 0
        };

        learners.forEach(l => {
            const status = (l.derivedStatus || "unknown") as keyof typeof summary;
            if (summary.hasOwnProperty(status)) {
                summary[status]++;
            } else {
                summary.unknown++;
            }
        });

        // 🔍 TEMP DEBUG — remove after confirming friction radar works
        console.log('[FrictionDebug] learners:', learners.map(l => ({
            name: l.fullName,
            derivedStatus: l.derivedStatus,
            dominant: l.analysis?.dominantStruggle,
            severity: l.analysis?.severity,
            scores: l.analysis?.scores,
        })));

        res.json({ learners, summary });
    })
);

/**
 * GET /activity/learners/:userId/history
 * Returns the activity history for a specific learner in a course.
 */
router.get(
    "/learners/:learnerUserId/history",
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
        const { learnerUserId } = req.params;
        const courseId = req.query.courseId as string;
        const limit = parseInt(req.query.limit as string) || 40;
        const before = req.query.before ? new Date(req.query.before as string) : null;
        const { userId, role } = req.auth!;

        if (!courseId) {
            return res.status(400).json({ message: "courseId query parameter is required" });
        }

        // Ensure user has access to this course's telemetry
        await ensureTutorOrAdminAccess(userId, courseId, role);

        const events = await getLearnerHistory({
            userId: learnerUserId,
            courseId,
            limit,
            before
        });

        res.json({ events });
    })
);

export { router as activityRouter };
