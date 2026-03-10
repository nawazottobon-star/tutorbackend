import express from "express";
import { asyncHandler } from "../shared/utils/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { getAllCourses, getCourseById, resolveCourseIdOrError, mapCourse } from "../services/courseService";

const coursesRouter = express.Router();

coursesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const courses = await getAllCourses();
    res.status(200).json({ courses });
  }),
);

coursesRouter.get(
  "/:courseKey",
  asyncHandler(async (req, res) => {
    const resolved = await resolveCourseIdOrError(req.params.courseKey);
    if ("errorStatus" in resolved) {
      res.status(resolved.errorStatus).json({ message: resolved.errorMessage });
      return;
    }

    const course = await getCourseById(resolved.courseId);

    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    res.status(200).json({ course: mapCourse(course) });
  }),
);

export { coursesRouter };
