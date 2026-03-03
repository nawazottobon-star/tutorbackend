import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const targetTutorId = 'dc44d9e9-04f4-4ae5-a9f6-c7ed1aaedefb'; // NEW nawaz tutor
  
  try {
    const deleted = await prisma.courseTutor.deleteMany({
      where: { tutorId: targetTutorId }
    });
    console.log(`Deleted ${deleted.count} course assignments for nawaz12@gmail.com`);

    // Also clear any submissions to make it a FRESH tutor account
    const deletedSubs = await prisma.courseSubmission.deleteMany({
      where: { tutorId: targetTutorId }
    });
    console.log(`Deleted ${deletedSubs.count} previous submissions.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
