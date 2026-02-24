import { Prisma } from "@prisma/client";
import { prisma } from "../src/services/prisma";
import { hashPassword } from "../src/utils/password";

async function main() {
  const email = "nawaz@example.com";
  const plainPassword = "yourpassword123";
  const passwordHash = await hashPassword(plainPassword);

  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash, role: "tutor" },
  });

  await prisma.$executeRaw(Prisma.sql`
    UPDATE tutors
    SET password_hash = ${passwordHash}, password = ${plainPassword}
    WHERE user_id = ${user.userId}::uuid
  `);

  console.log("Updated tutor credentials", { userId: user.userId });
}

main()
  .catch((error) => {
    console.error("Failed to update tutor credentials", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
