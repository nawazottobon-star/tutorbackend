import type { Request } from "express";
import { prisma } from "./prisma";
import { verifyAccessToken } from "./sessionService";

export const COHORT_ACCESS_DENIED_MESSAGE =
  "You are not in the cohort batch, please register first.";

type CohortRecord = {
  cohortId: string;
  name: string;
};

type AccessDecision =
  | { allowed: true }
  | { allowed: false; status: number; message: string };

const ACTIVE_MEMBER_STATUS = "active";

const toLowerEmail = (value: string) => value.trim().toLowerCase();

const listActiveCohorts = async (courseId: string): Promise<CohortRecord[]> => {
  if (!courseId) {
    return [];
  }

  return prisma.cohort.findMany({
    where: { courseId, isActive: true },
    select: { cohortId: true, name: true },
  });
};

const resolveAuthUserId = (req: Request): AccessDecision | { userId: string } => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { allowed: false, status: 401, message: "Authorization header is missing" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { allowed: false, status: 401, message: "Access token is missing" };
  }

  try {
    const payload = verifyAccessToken(token);
    return { userId: payload.sub };
  } catch (error) {
    return {
      allowed: false,
      status: 401,
      message: error instanceof Error ? error.message : "Invalid access token",
    };
  }
};

export const checkCohortAccessForUser = async (
  userId: string,
  courseId: string,
  activeCohorts?: CohortRecord[],
): Promise<AccessDecision> => {
  const cohorts = activeCohorts ?? (await listActiveCohorts(courseId));
  if (cohorts.length === 0) {
    return { allowed: true };
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { email: true },
  });

  if (!user?.email) {
    return { allowed: false, status: 401, message: "Unauthorized" };
  }

  const normalizedEmail = toLowerEmail(user.email);
  const cohortIds = cohorts.map((cohort) => cohort.cohortId);

  const member = await prisma.cohortMember.findFirst({
    where: {
      cohortId: { in: cohortIds },
      status: ACTIVE_MEMBER_STATUS,
      OR: [
        { userId },
        { email: { equals: normalizedEmail, mode: "insensitive" } },
      ],
    },
    select: { memberId: true, userId: true, email: true },
  });

  if (!member) {
    return { allowed: false, status: 403, message: COHORT_ACCESS_DENIED_MESSAGE };
  }

  if (!member.userId || member.email !== normalizedEmail) {
    await prisma.cohortMember.update({
      where: { memberId: member.memberId },
      data: { userId, email: normalizedEmail },
    });
  }

  return { allowed: true };
};

export const checkCohortAccessFromRequest = async (
  req: Request,
  courseId: string,
): Promise<AccessDecision> => {
  const activeCohorts = await listActiveCohorts(courseId);
  if (activeCohorts.length === 0) {
    return { allowed: true };
  }

  const auth = resolveAuthUserId(req);
  if ("userId" in auth) {
    return checkCohortAccessForUser(auth.userId, courseId, activeCohorts);
  }

  return auth;
};
