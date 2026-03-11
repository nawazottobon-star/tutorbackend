import { Router } from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { prisma } from "../services/prisma.js";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ok", database: "connected" });
    } catch (error) {
      res.status(503).json({
        status: "degraded",
        database: "unavailable",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }),
);
