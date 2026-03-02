import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('Testing DB connection...');
try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ DB CONNECTED SUCCESSFULLY');
    await prisma.$disconnect();
} catch (e) {
    console.error('❌ DB CONNECTION FAILED:', e.message);
    process.exit(1);
}
