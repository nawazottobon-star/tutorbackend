import { prisma } from "./prisma";

export const PROMPT_LIMIT_PER_MODULE = 5;

export async function getModulePromptUsageCount(
  userId: string,
  courseId: string,
  moduleNo: number,
): Promise<number> {
  const record = await prisma.modulePromptUsage.findUnique({
    where: {
      userId_courseId_moduleNo: {
        userId,
        courseId,
        moduleNo,
      },
    },
    select: { typedCount: true },
  });

  return record?.typedCount ?? 0;
}

export async function incrementModulePromptUsage(
  userId: string,
  courseId: string,
  moduleNo: number,
): Promise<number> {
  const updated = await prisma.modulePromptUsage.upsert({
    where: {
      userId_courseId_moduleNo: {
        userId,
        courseId,
        moduleNo,
      },
    },
    create: {
      userId,
      courseId,
      moduleNo,
      typedCount: 1,
    },
    update: {
      typedCount: { increment: 1 },
    },
    select: { typedCount: true },
  });

  return updated.typedCount;
}
