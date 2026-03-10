import { PrismaClient } from '@prisma/client';

async function verifyTables() {
    const prisma = new PrismaClient();
    try {
        console.log('Checking tables...');

        const tables = ['workshops', 'course_offerings', 'workshop_sessions', 'assessment_questions'];
        for (const table of tables) {
            try {
                await prisma.$queryRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`);
                console.log(`Table '${table}' exists.`);
            } catch (e) {
                console.error(`Table '${table}' DOES NOT exist or error accessing:`, e.message);
            }
        }
    } catch (error) {
        console.error('Error connecting to database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyTables();
