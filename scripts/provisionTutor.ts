import { prisma } from "../src/services/prisma";
import { hashPassword } from "../src/utils/password";

const [, , emailArg, passwordArg, nameArg, courseArg] = process.argv;

async function resolveCourseId(preferred?: string): Promise<string> {
  if (preferred) {
    const normalized = preferred.trim();
    if (!normalized) {
      throw new Error("Provided course identifier is empty");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(normalized)) {
      return normalized;
    }

    const course = await prisma.course.findFirst({
      where: {
        OR: [
          { slug: { equals: normalized, mode: "insensitive" } },
          { courseName: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: { courseId: true },
    });

    if (!course) {
      throw new Error(`No course found for identifier "${normalized}"`);
    }
    return course.courseId;
  }

  const fallback = await prisma.course.findFirst({ select: { courseId: true, courseName: true } });
  if (!fallback) {
    throw new Error("No courses exist in the catalog. Seed courses before provisioning tutors.");
  }
  console.log(`No course identifier provided. Assigning tutor to "${fallback.courseName}".`);
  return fallback.courseId;
}

async function main() {
  const tutorEmail = emailArg?.toLowerCase() ?? process.env.TUTOR_EMAIL ?? "tutor@example.com";
  const fullName = nameArg ?? process.env.TUTOR_FULL_NAME ?? "Guest Tutor";
  const plainPassword = passwordArg ?? process.env.TUTOR_PASSWORD ?? "TutorPass123!";
  const courseIdentifier = courseArg ?? process.env.TUTOR_COURSE_ID;

  const passwordHash = await hashPassword(plainPassword);
  const courseId = await resolveCourseId(courseIdentifier);

  const user = await prisma.user.upsert({
    where: { email: tutorEmail },
    update: { fullName, passwordHash, role: "tutor" },
    create: { email: tutorEmail, fullName, passwordHash, role: "tutor" },
  });

  const tutor = await prisma.tutor.upsert({
    where: { userId: user.userId },
    update: { displayName: fullName },
    create: {
      userId: user.userId,
      displayName: fullName,
    },
  });

  await prisma.courseTutor.upsert({
    where: {
      courseId_tutorId: {
        courseId,
        tutorId: tutor.tutorId,
      },
    },
    update: { isActive: true },
    create: {
      courseId,
      tutorId: tutor.tutorId,
      role: "owner",
    },
  });

  console.log("Provisioned tutor account", {
    email: tutorEmail,
    password: plainPassword,
    userId: user.userId,
    tutorId: tutor.tutorId,
    courseId,
  });
}

main()
  .catch((error) => {
    console.error("Failed to provision tutor", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
