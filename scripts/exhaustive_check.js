import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const tutors = await prisma.tutor.findMany();
    console.log('ALL TUTORS:');
    console.log(JSON.stringify(tutors, null, 2));

    const assignments = await prisma.courseTutor.findMany({
        include: {
            course: true,
            tutor: true
        }
    });
    console.log('\nALL ASSIGNMENTS:');
    assignments.forEach(a => {
        console.log(`Course: ${a.course.courseName} -> Tutor: ${a.tutor.displayName} (userId: ${a.tutor.userId})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
