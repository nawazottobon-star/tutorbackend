import express from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import {
  getTopicsByModuleNo,
  resolveCourseId,
  getTopicsByCourseId,
} from "../services/lessonService.js";

export const lessonsRouter = express.Router();

lessonsRouter.get(
  "/modules/:moduleNo/topics",
  asyncHandler(async (req, res) => {
    const moduleNo = Number.parseInt(req.params.moduleNo, 10);
    if (Number.isNaN(moduleNo)) {
      res.status(400).json({ message: "Module number must be a valid integer" });
      return;
    }
    const topics = await getTopicsByModuleNo(moduleNo);
    res.status(200).json({ topics });
  }),
);

lessonsRouter.get(
  "/courses/:courseKey/topics",
  asyncHandler(async (req, res) => {
    const { courseKey } = req.params;
    if (!courseKey || typeof courseKey !== "string") {
      res.status(400).json({ message: "course identifier is required" });
      return;
    }

    const resolvedCourseId = await resolveCourseId(courseKey);
    if (!resolvedCourseId) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const topics = await getTopicsByCourseId(resolvedCourseId);
    res.status(200).json({ topics });
  }),
);


