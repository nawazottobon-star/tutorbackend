import { OAuth2Client } from "google-auth-library";
import type { Credentials } from "google-auth-library";
import { env } from "../config/env";

const oauthClient = new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);

export type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

export function generateGoogleAuthUrl(state?: string): string {
  return oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "profile"],
    state,
  });
}

async function getUserFromIdToken(idToken: string): Promise<GoogleUserInfo | undefined> {
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: env.googleClientId,
  });
  const payload = ticket.getPayload();

  if (payload?.email) {
    return {
      sub: payload.sub as string,
      email: payload.email,
      email_verified: payload.email_verified ?? false,
      name: payload.name,
      picture: payload.picture,
    };
  }

  return undefined;
}

async function fetchGoogleUser(accessToken: string, idToken?: string): Promise<GoogleUserInfo> {
  if (idToken) {
    const user = await getUserFromIdToken(idToken);
    if (user) {
      return user;
    }
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google user info (${response.status})`);
  }

  const data = (await response.json()) as GoogleUserInfo;
  if (!data.email) {
    throw new Error("Google user does not include an email address");
  }

  return data;
}

export async function exchangeCodeForTokens(code: string): Promise<{ tokens: Credentials; profile: GoogleUserInfo }> {
  const { tokens } = await oauthClient.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }

  const profile = await fetchGoogleUser(tokens.access_token, tokens.id_token ?? undefined);
  return { tokens, profile };
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  const user = await getUserFromIdToken(idToken);
  if (!user) {
    throw new Error("Invalid Google ID token");
  }
  return user;
}
