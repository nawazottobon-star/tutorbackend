import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const authUserId = '1c325808-56c3-420e-8590-acefa9a65cfb'; // NEW nawaz
  try {
    const courses = await prisma.courseTutor.findMany({
      where: {
        isActive: true,
        tutor: { userId: authUserId },
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

    console.log('API MOCK Result for /api/tutors/me/courses:');
    console.log(JSON.stringify(courses.map((entry) => ({
        courseId: entry.course.courseId,
        title: entry.course.courseName
    })), null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
