import express from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { generateGoogleAuthUrl } from "../services/googleOAuth.js";
import { deleteSessionByRefreshToken, renewSessionTokens } from "../services/sessionService.js";
import { createOauthStateCookie, readOauthStateCookie, clearOauthStateCookie } from "../shared/utils/oauthState.js";
import { env } from "../config/env.js";
import { loginWithPassword, processGoogleCodeExchange, processGoogleIdToken } from "../services/authService.js";

export const authRouter = express.Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const result = await loginWithPassword(req.body?.email, req.body?.password);
    if (result.status === 200 && result.data) {
      res.status(200).json(result.data);
    } else {
      res.status(result.status).json({ message: result.message });
    }
  }),
);

authRouter.get(
  "/google",
  (req, res) => {
    const redirectPath = typeof req.query.redirect === "string" ? req.query.redirect : undefined;
    const state = createOauthStateCookie(res, redirectPath);
    const redirectUrl = generateGoogleAuthUrl(state);
    res.redirect(redirectUrl);
  },
);

authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const errorParam = typeof req.query.error === "string" ? req.query.error : undefined;
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;

    const redirectToFrontend = (params: Record<string, string | undefined>) => {
      const callbackUrl = new URL("/auth/callback", env.frontendAppUrl);
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          callbackUrl.searchParams.set(key, value);
        }
      });
      console.log("OAuth redirect URL:", callbackUrl.toString());
      res.redirect(callbackUrl.toString());
    };

    if (errorParam) {
      clearOauthStateCookie(res);
      redirectToFrontend({ error: errorParam });
      return;
    }

    if (!code || !state) {
      clearOauthStateCookie(res);
      redirectToFrontend({ error: "missing_code_or_state" });
      return;
    }

    const statePayload = readOauthStateCookie(req);
    clearOauthStateCookie(res);

    if (!statePayload || statePayload.state !== state) {
      redirectToFrontend({ error: "invalid_oauth_state" });
      return;
    }

    try {
      const { profile, user, tokens } = await processGoogleCodeExchange(code);
      redirectToFrontend({
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
        sessionId: tokens.sessionId,
        userId: user.userId,
        userEmail: user.email,
        userFullName: user.fullName,
        userPicture: profile.picture ?? undefined,
        userEmailVerified: profile.email_verified ? "true" : undefined,
        redirectPath: statePayload.redirectPath,
      });
    } catch (error) {
      console.error("Failed to handle Google OAuth callback", error);
      redirectToFrontend({ error: "oauth_exchange_failed" });
    }
  }),
);

authRouter.post(
  "/google/exchange",
  asyncHandler(async (req, res) => {
    const codeFromBody = typeof req.body?.code === "string" ? req.body.code : undefined;
    const codeFromQuery = typeof req.query.code === "string" ? req.query.code : undefined;
    const code = (codeFromBody ?? codeFromQuery)?.trim();

    if (!code) {
      res.status(400).json({ message: "Authorization code is required" });
      return;
    }

    const { profile, user, tokens } = await processGoogleCodeExchange(code);

    res.status(200).json({
      user: {
        id: user.userId,
        email: user.email,
        fullName: user.fullName,
        emailVerified: profile.email_verified ?? false,
      },
      session: {
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
        sessionId: tokens.sessionId,
      },
    });
  }),
);

authRouter.post(
  "/google/id-token",
  asyncHandler(async (req, res) => {
    const idToken = typeof req.body?.credential === "string"
      ? req.body.credential
      : typeof req.body?.idToken === "string"
        ? req.body.idToken
        : undefined;

    if (!idToken) {
      res.status(400).json({ message: "Google credential is required" });
      return;
    }

    const { profile, user, tokens } = await processGoogleIdToken(idToken.trim());

    res.status(200).json({
      user: {
        id: user.userId,
        email: user.email,
        fullName: user.fullName,
        emailVerified: profile.email_verified ?? false,
      },
      session: {
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
        sessionId: tokens.sessionId,
      },
    });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (typeof refreshToken !== "string" || !refreshToken.trim()) {
      res.status(400).json({ message: "refreshToken is required" });
      return;
    }

    try {
      const tokens = await renewSessionTokens(refreshToken.trim());
      res.status(200).json({
        session: {
          accessToken: tokens.accessToken,
          accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
          refreshToken: tokens.refreshToken,
          refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
          sessionId: tokens.sessionId,
        },
      });
    } catch (error) {
      res.status(401).json({ message: error instanceof Error ? error.message : "Invalid refresh token" });
    }
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (typeof refreshToken !== "string" || !refreshToken.trim()) {
      res.status(400).json({ message: "refreshToken is required" });
      return;
    }

    try {
      await deleteSessionByRefreshToken(refreshToken.trim());
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to revoke session" });
    }
  }),
);

