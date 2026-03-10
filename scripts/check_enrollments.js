import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const enrollmentsCount = await prisma.enrollment.count({
      where: { courseId: '74d2b27a-fa98-42c8-afa5-72d263239945' } // AI Data Labeling
    });
    console.log('Enrollments for AI Data Labeling:', enrollmentsCount);

    const enrollmentsCount2 = await prisma.enrollment.count({
      where: { courseId: 'f26180b2-5dda-495a-a014-ae02e63f172f' } // AI Native FullStack
    });
    console.log('Enrollments for AI Native FullStack:', enrollmentsCount2);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
