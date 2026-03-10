// Quick database connection test
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
    console.log('\n🔍 Testing Database Connection...\n');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

    try {
        console.log('⏳ Attempting to connect to database...');
        await prisma.$connect();
        console.log('✅ Successfully connected to database!\n');

        // Test a simple query
        console.log('⏳ Testing query: Counting users...');
        const userCount = await prisma.user.count();
        console.log(`✅ User count: ${userCount}`);

        console.log('⏳ Testing query: Counting courses...');
        const courseCount = await prisma.course.count();
        console.log(`✅ Course count: ${courseCount}`);

        console.log('\n✅ Database connection is working properly!\n');
    } catch (error) {
        console.error('\n❌ Database connection failed!');
        console.error('Error details:', error);
        console.error('\nPlease check:');
        console.error('1. Database URL in .env file');
        console.error('2. Database server is running');
        console.error('3. Network connectivity\n');
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Disconnected from database\n');
    }
}

testConnection();
