import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { env } from "../config/env";

type AccessTokenPayload = {
  sub: string;
  sid: string;
  jti: string;
  role?: string;
  iat: number;
  exp: number;
};

type RefreshTokenPayload = {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
  tokenType: "refresh";
};

export type SessionTokens = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
};

const ACCESS_TOKEN_LEEWAY_MS = 10_000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function calculateRefreshExpiry(): Date {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + env.jwtRefreshTokenTtlDays);
  return now;
}

export async function createSession(userId: string, userRole?: string): Promise<SessionTokens> {
  const sessionId = crypto.randomUUID();
  const jwtId = crypto.randomUUID();
  const refreshExpiresAt = calculateRefreshExpiry();

  const accessToken = jwt.sign(
    { sub: userId, sid: sessionId, jti: jwtId, role: userRole },
    env.jwtSecret,
    { expiresIn: env.jwtAccessTokenTtlSeconds },
  );
  const accessDecoded = jwt.decode(accessToken) as AccessTokenPayload;

  const refreshToken = jwt.sign(
    { sub: userId, sid: sessionId, tokenType: "refresh" },
    env.jwtRefreshSecret,
    { expiresIn: `${env.jwtRefreshTokenTtlDays}d`, jwtid: jwtId },
  );

  await prisma.userSession.create({
    data: {
      id: sessionId,
      userId,
      jwtId,
      refreshToken: hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
    },
  });

  return {
    accessToken,
    accessTokenExpiresAt: new Date(accessDecoded.exp * 1000),
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt,
    sessionId,
  };
}

export async function renewSessionTokens(refreshToken: string): Promise<SessionTokens> {
  let payload: RefreshTokenPayload & { jti?: string };
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as RefreshTokenPayload & { jti?: string };
  } catch {
    throw new Error("Invalid refresh token");
  }

  if (payload.tokenType !== "refresh") {
    throw new Error("Invalid refresh token payload");
  }

  if (!payload.sid || !payload.sub || !payload.jti) {
    throw new Error("Refresh token missing required claims");
  }

  const existing = await prisma.userSession.findUnique({
    where: { id: payload.sid },
  });

  if (!existing) {
    throw new Error("Session not found");
  }

  if (existing.expiresAt < new Date()) {
    await prisma.userSession.delete({ where: { id: existing.id } });
    throw new Error("Session expired");
  }

  const hashedRefresh = hashToken(refreshToken);
  if (existing.refreshToken !== hashedRefresh || existing.jwtId !== payload.jti) {
    throw new Error("Session token mismatch");
  }

  const newJwtId = crypto.randomUUID();

  const user = await prisma.user.findUnique({
    where: { userId: payload.sub },
    select: { role: true },
  });

  const newAccessToken = jwt.sign(
    { sub: payload.sub, sid: payload.sid, jti: newJwtId, role: user?.role },
    env.jwtSecret,
    { expiresIn: env.jwtAccessTokenTtlSeconds },
  );
  const decoded = jwt.decode(newAccessToken) as AccessTokenPayload;

  const newRefreshToken = jwt.sign(
    { sub: payload.sub, sid: payload.sid, tokenType: "refresh" },
    env.jwtRefreshSecret,
    { expiresIn: `${env.jwtRefreshTokenTtlDays}d`, jwtid: newJwtId },
  );

  const newRefreshExpiresAt = calculateRefreshExpiry();

  await prisma.userSession.update({
    where: { id: payload.sid },
    data: {
      jwtId: newJwtId,
      refreshToken: hashToken(newRefreshToken),
      expiresAt: newRefreshExpiresAt,
    },
  });

  return {
    accessToken: newAccessToken,
    accessTokenExpiresAt: new Date(decoded.exp * 1000),
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt: newRefreshExpiresAt,
    sessionId: payload.sid,
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.userSession.deleteMany({
    where: { id: sessionId },
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
  const expiryWithLeeway = payload.exp * 1000 + ACCESS_TOKEN_LEEWAY_MS;
  if (expiryWithLeeway <= Date.now()) {
    throw new Error("Access token expired");
  }
  return payload;
}

export async function deleteSessionByRefreshToken(refreshToken: string): Promise<void> {
  let payload: RefreshTokenPayload & { jti?: string };
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as RefreshTokenPayload & { jti?: string };
  } catch {
    throw new Error("Invalid refresh token");
  }

  if (!payload.sid || !payload.jti) {
    throw new Error("Invalid refresh token payload");
  }

  const session = await prisma.userSession.findUnique({
    where: { id: payload.sid },
  });

  if (!session) {
    return;
  }

  if (session.refreshToken !== hashToken(refreshToken) || session.jwtId !== payload.jti) {
    throw new Error("Refresh token does not match the active session");
  }

  await prisma.userSession.delete({
    where: { id: session.id },
  });
}
