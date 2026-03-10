import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const counts = await prisma.cohortMember.groupBy({
        by: ['cohortId'],
        _count: {
            memberId: true
        }
    });

    const cohorts = await prisma.cohort.findMany();
    const cohortMap = new Map(cohorts.map(c => [c.cohortId, c.name]));
    const cohortCourseMap = new Map(cohorts.map(c => [c.cohortId, c.courseId]));

    const courses = await prisma.course.findMany();
    const courseMap = new Map(courses.map(c => [c.courseId, c.courseName]));

    console.log('Cohort Member Counts:');
    counts.forEach(item => {
        const courseName = courseMap.get(cohortCourseMap.get(item.cohortId));
        console.log(`Course: ${courseName}, Cohort: ${cohortMap.get(item.cohortId)}, Count: ${item._count.memberId}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
