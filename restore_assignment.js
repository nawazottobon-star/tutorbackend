import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tutorId = 'dc44d9e9-04f4-4ae5-a9f6-c7ed1aaedefb';
  const courseId = '74d2b27a-fa98-42c8-afa5-72d263239945';
  const courseTutorId = '7a3693ba-56ae-4271-85bc-de9e1975d8c8';

  try {
    const restored = await prisma.courseTutor.create({
      data: {
        courseTutorId: courseTutorId,
        courseId: courseId,
        tutorId: tutorId,
        role: 'tutor',
        isActive: true,
        // Using the original timestamps if possible, otherwise defaults
        createdAt: new Date('2026-03-02T14:25:56.030Z'),
        updatedAt: new Date('2026-03-02T14:25:56.030Z')
      }
    });
    console.log('Restored course assignment successfully:', restored.courseTutorId);
  } catch (error) {
    console.error('Error restoring assignment:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
