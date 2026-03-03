import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const courses = await prisma.course.findMany({
      select: {
          courseId: true,
          courseName: true
      }
    });
    console.log('Courses:');
    console.log(JSON.stringify(courses, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
