import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const submissions = await prisma.courseSubmission.findMany({
      include: {
        tutor: {
          select: {
            displayName: true,
          }
        },
      }
    });
    console.log(JSON.stringify(submissions, null, 2));
  } catch (error) {
    console.error('Error fetching submissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
