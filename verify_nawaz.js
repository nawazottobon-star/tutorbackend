import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const targetUserId = '1c325808-56c3-420e-8590-acefa9a65cfb'; // NEW nawaz
  const targetTutorId = 'dc44d9e9-04f4-4ae5-a9f6-c7ed1aaedefb'; // NEW nawaz tutor
  
  try {
    const courseTutors = await prisma.courseTutor.findMany({
      where: {
        OR: [
          { tutorId: targetTutorId },
          { tutor: { userId: targetUserId } }
        ]
      },
      include: {
          course: true
      }
    });
    console.log('Assignments for NEW nawaz:');
    console.log(JSON.stringify(courseTutors, null, 2));

    const courseSubmissions = await prisma.courseSubmission.findMany({
      where: {
        OR: [
          { tutorId: targetTutorId },
          { tutor: { userId: targetUserId } }
        ]
      }
    });
    console.log('\nSubmissions for NEW nawaz:');
    console.log(JSON.stringify(courseSubmissions, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
