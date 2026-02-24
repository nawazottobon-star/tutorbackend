import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/sessionService";

export type AuthContext = {
  userId: string;
  sessionId: string;
  jwtId: string;
  role?: string;
};

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authorization header is missing" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ message: "Access token is missing" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      jwtId: payload.jti,
      role: payload.role,
    };
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "Invalid access token" });
    return;
  }

  next();
}
