import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const courseTutors = await prisma.courseTutor.findMany({
      include: {
        tutor: {
          select: {
            tutorId: true,
            displayName: true,
            user: {
              select: {
                userId: true,
                email: true,
                fullName: true
              }
            }
          }
        },
        course: {
          select: {
            courseId: true,
            courseName: true
          }
        }
      }
    });
    console.log(JSON.stringify(courseTutors, null, 2));
  } catch (error) {
    console.error('Error fetching course tutors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
