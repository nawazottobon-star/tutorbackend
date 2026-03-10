import express from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { findUserById } from "../services/userService";
import { asyncHandler } from "../shared/utils/asyncHandler";

export const usersRouter = express.Router();

usersRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const user = await findUserById(auth.userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      user: {
        id: user.userId,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt.toISOString(),
      },
    });
  }),
);
