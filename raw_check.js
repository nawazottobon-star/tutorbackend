import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT * FROM course_tutors`;
    console.log('RAW COURSE TUTORS:');
    console.log(JSON.stringify(result, null, 2));

    const result2 = await prisma.$queryRaw`SELECT * FROM tutors`;
    console.log('\nRAW TUTORS:');
    console.log(JSON.stringify(result2, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
