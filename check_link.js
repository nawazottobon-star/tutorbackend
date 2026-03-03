import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const tutor = await prisma.tutor.findFirst({
        where: { userId: 'bcead2e4-6404-4fab-9759-0f037a5a1e45' } // OLD Nawaz User ID
    });
    console.log('Tutor profile for bcead2:');
    console.log(JSON.stringify(tutor, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
