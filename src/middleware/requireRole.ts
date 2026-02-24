import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";

export function requireTutor(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.role || auth.role !== "tutor") {
    res.status(403).json({ message: "Tutor access required" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.role || auth.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}
