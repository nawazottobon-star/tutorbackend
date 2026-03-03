import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const courseTutors = await prisma.courseTutor.findMany();
    console.log('CourseTutor Table:');
    console.log(JSON.stringify(courseTutors, null, 2));

    const tutors = await prisma.tutor.findMany();
    console.log('\nTutors Table:');
    console.log(JSON.stringify(tutors, null, 2));

    const users = await prisma.user.findMany({
      where: { role: 'tutor' }
    });
    console.log('\nTutor Users:');
    console.log(JSON.stringify(users, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
