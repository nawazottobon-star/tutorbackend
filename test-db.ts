import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing database connection...');
        await prisma.$connect();
        console.log('Successfully connected to database.');

        const userCount = await prisma.user.count();
        console.log(`User count: ${userCount}`);

        const courseCount = await prisma.course.count();
        console.log(`Course count: ${courseCount}`);

        // Check for courses if the model exists. 
        // I don't know the schema for sure, but "Course" is a reasonable guess given the repo name.
        // Let's just list tables or generic query if possible, or assume standard models.
        // I'll stick to a simple query first.

        // Let's try to query 'Course' blindly or check for known content.
        // Actually, let's just inspect the schema content first.
    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
