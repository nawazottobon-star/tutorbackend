import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const targetTutorId = 'dc44d9e9-04f4-4ae5-a9f6-c7ed1aaedefb'; // NEW nawaz tutor
  const assignmentId = '7a3693ba-56ae-4271-85bc-de9e1975d8c8';
  
  try {
    const deleted = await prisma.courseTutor.delete({
      where: { courseTutorId: assignmentId }
    });
    console.log('Successfully detached "AI Data Labeling" from nawaz12@gmail.com');
    console.log('Record ID removed:', deleted.courseTutorId);
  } catch (error) {
    console.error('Error removing assignment:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
