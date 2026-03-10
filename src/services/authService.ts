import { prisma } from "./prisma";
import { verifyPassword } from "../shared/utils/password";
import { createSession } from "./sessionService";
import { exchangeCodeForTokens, verifyGoogleIdToken } from "./googleOAuth";
import { findOrCreateUserFromGoogle } from "./userService";

export async function loginWithPassword(emailRaw: string | undefined, passwordRaw: string | undefined) {
    const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : "";

    if (!email || !password) {
        return { status: 400, message: "email and password are required" };
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: { userId: true, passwordHash: true, fullName: true, role: true },
    });

    if (!user || user.role === "learner") {
        return { status: 403, message: "Tutor or admin account required" };
    }

    if (!user.passwordHash) {
        return { status: 401, message: "This account uses Google Sign-In. Please log in with Google." };
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
        return { status: 401, message: "Invalid credentials" };
    }

    const tokens = await createSession(user.userId, user.role);

    return {
        status: 200,
        data: {
            user: {
                id: user.userId,
                email,
                fullName: user.fullName,
                role: user.role,
            },
            session: {
                accessToken: tokens.accessToken,
                accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
                refreshToken: tokens.refreshToken,
                refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
                sessionId: tokens.sessionId,
            },
        },
    };
}

export async function processGoogleCodeExchange(code: string) {
    const { profile } = await exchangeCodeForTokens(code);
    const user = await findOrCreateUserFromGoogle(profile);
    const tokens = await createSession(user.userId, user.role);

    return { profile, user, tokens };
}

export async function processGoogleIdToken(idToken: string) {
    const profile = await verifyGoogleIdToken(idToken);
    const user = await findOrCreateUserFromGoogle(profile);
    const tokens = await createSession(user.userId, user.role);

    return { profile, user, tokens };
}
