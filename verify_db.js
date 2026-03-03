import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'course_submissions'
      ORDER BY ordinal_position;
    `;
    
    if (result.length === 0) {
      console.log('TABLE NOT FOUND: course_submissions');
    } else {
      console.log('TABLE FOUND! Columns:');
      console.table(result);
    }
  } catch (e) {
    console.error('Error querying DB:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
