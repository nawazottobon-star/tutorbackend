// List all tables using raw Prisma query
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const result = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
);

console.log('\n=== ALL TABLES IN DATABASE ===');
result.forEach(r => console.log(' -', r.table_name));

await prisma.$disconnect();
