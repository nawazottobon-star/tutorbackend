import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const userId = '1c325808-56c3-420e-8590-acefa9a65cfb'; // nawaz12
  
  const count = await prisma.courseTutor.count({
    where: {
      isActive: true,
      tutor: { userId: userId },
    },
  });
  
  console.log(`Course count for ${userId}:`, count);
  console.log('hasCourses:', count > 0);
  
  const tutor = await prisma.tutor.findUnique({
    where: { userId }
  });
  console.log('Tutor profile:', tutor);

  const submissions = await prisma.courseSubmission.findMany({
    where: { tutorId: tutor?.tutorId },
  });
  console.log('Submission count:', submissions.length);
}

test().catch(console.error).finally(() => prisma.$disconnect());
