import express from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireRole.js";
import { getTutorApplications, approveTutorApplication } from "../services/adminService.js";

const adminRouter = express.Router();

adminRouter.get(
  "/tutor-applications",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const applications = await getTutorApplications();
    res.status(200).json({ applications });
  }),
);

adminRouter.post(
  "/tutor-applications/:applicationId/approve",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { applicationId } = req.params;

    const result = await approveTutorApplication(applicationId);

    if (result.status === 200 && result.data) {
      res.status(200).json(result.data);
    } else {
      res.status(result.status).json({ message: result.message });
    }
  }),
);

export { adminRouter };
