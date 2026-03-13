import express from "express";
import type { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { lessonsRouter } from "./routes/lessons.js";
import { coursesRouter } from "./routes/courses.js";
import { tutorApplicationsRouter } from "./routes/tutorApplications.js";
import { pagesRouter } from "./routes/pages.js";
import { env } from "./config/env.js";
import { tutorsRouter } from "./routes/tutors.js";
import { adminRouter } from "./routes/admin.js";
import { activityRouter } from "./routes/activity.js";
import { courseSubmissionsRouter } from "./routes/courseSubmissions.js";
import { workshopsRouter } from "./routes/workshops.js";
import { publicWorkshopsRouter } from "./routes/publicWorkshops.js";
import { coldCallRouter } from "./routes/coldCall.js";

export function createApp(): Express {
  const app = express();

  const allowedOrigins = [...env.frontendAppUrls, 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];
  const corsOptions: cors.CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.some((allowed) => origin === allowed)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.get("/", (_req, res) => {
    res.status(200).json({ message: "Course Platform API" });
  });
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/lessons", lessonsRouter);
  app.use("/courses", coursesRouter);
  app.use("/tutor-applications", tutorApplicationsRouter);
  app.use("/pages", pagesRouter);
  app.use("/tutors", tutorsRouter);
  app.use("/course-submissions", courseSubmissionsRouter);
  app.use("/admin", adminRouter);
  app.use("/activity", activityRouter);

  // Mirror routes under /api/* so the frontend can call them with a consistent prefix.
  const apiRouter = express.Router();
  apiRouter.use("/health", healthRouter);
  apiRouter.use("/auth", authRouter);
  apiRouter.use("/users", usersRouter);
  apiRouter.use("/lessons", lessonsRouter);
  apiRouter.use("/courses", coursesRouter);
  apiRouter.use("/tutor-applications", tutorApplicationsRouter);
  apiRouter.use("/pages", pagesRouter);
  apiRouter.use("/tutors", tutorsRouter);
  apiRouter.use("/course-submissions", courseSubmissionsRouter);
  apiRouter.use("/admin", adminRouter);
  apiRouter.use("/activity", activityRouter);
  apiRouter.use("/workshops", workshopsRouter);
  apiRouter.use("/public/workshops", publicWorkshopsRouter);
  apiRouter.use("/cold-call", coldCallRouter);
  app.use("/api", apiRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error", err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}
