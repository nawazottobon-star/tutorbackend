import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const counts = await prisma.enrollment.groupBy({
        by: ['courseId'],
        _count: {
            enrollmentId: true
        }
    });

    const courses = await prisma.course.findMany();
    const courseMap = new Map(courses.map(c => [c.courseId, c.courseName]));

    console.log('Enrollment Counts per Course:');
    counts.forEach(item => {
        console.log(`${courseMap.get(item.courseId)}: ${item._count.enrollmentId}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
