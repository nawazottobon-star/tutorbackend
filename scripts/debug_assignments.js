import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const targetUserId = '1c325808-56c3-420e-8590-acefa9a65cfb'; // NEW nawaz
  try {
    const courses = await prisma.courseTutor.findMany({
      where: {
        isActive: true,
        tutor: { userId: targetUserId },
      },
      include: {
        course: {
          select: {
            courseId: true,
            courseName: true,
            slug: true,
            description: true,
          },
        },
      },
    });

    console.log('Courses for NEW nawaz:');
    console.log(JSON.stringify(courses, null, 2));

    const allAssignments = await prisma.courseTutor.findMany({
        where: { courseId: 'f26180b2-5dda-495a-a014-ae02e63f172f' } // AI Native FullStack
    });
    console.log('\nAssignments for AI Native Course:');
    console.log(JSON.stringify(allAssignments, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
