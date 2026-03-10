import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

const prisma = new PrismaClient({
    log: ['error', 'warn'],
});

async function main() {
    try {
        console.log('\n⏳ Testing connection...');
        const result = await prisma.$queryRaw`SELECT version()`;
        console.log('✅ DB IS UP! Result:', result);
    } catch (e) {
        console.log('\n❌ FAILED:', e.message);
        console.log('Error Code:', e.errorCode ?? e.code);
        console.log('Meta:', e.meta);
    } finally {
        await prisma.$disconnect();
    }
}

main();
