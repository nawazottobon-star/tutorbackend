import { prisma } from "../src/services/prisma";
import { hashPassword } from "../src/utils/password";

async function main() {
  const courseId = "f26180b2-5dda-495a-a014-ae02e63f172f";
  const tutorEmail = "nawaz@example.com";
  const tutorFullName = "Nawaz";
  const displayName = "Nawaz";
  const plainPassword = "yourpassword123";

  const passwordHash = await hashPassword(plainPassword);

  const user = await prisma.user.upsert({
    where: { email: tutorEmail },
    update: {
      fullName: tutorFullName,
      passwordHash,
      role: "tutor",
    },
    create: {
      email: tutorEmail,
      fullName: tutorFullName,
      passwordHash,
      role: "tutor",
    },
  });

  const tutor = await prisma.tutor.upsert({
    where: { userId: user.userId },
    update: {
      displayName,
      email: tutorEmail,
      password: plainPassword,
      passwordHash,
    },
    create: {
      userId: user.userId,
      displayName,
      email: tutorEmail,
      password: plainPassword,
      passwordHash,
    },
  });

  await prisma.courseTutor.upsert({
    where: {
      courseId_tutorId: {
        courseId,
        tutorId: tutor.tutorId,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      courseId,
      tutorId: tutor.tutorId,
      role: "owner",
    },
  });

  console.log("Seeded tutor login:", {
    userId: user.userId,
    tutorId: tutor.tutorId,
    courseId,
  });
}

main()
  .catch((error) => {
    console.error("Failed to seed tutor login", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
