// Inspect column structure of candidate tables for workshop feature
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const tables = [
    'registrations',
    'quiz_questions',
    'quiz_options',
    'quiz_attempts',
    'course_offerings',
    'assessment_questions',
    'video_watch_log',
    'course_chunks',
    'announcements_talentops',
];

for (const table of tables) {
    try {
        const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${table}'
      ORDER BY ordinal_position
    `);
        console.log(`\n=== ${table} ===`);
        cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`));
    } catch (e) {
        console.log(`\n=== ${table} === ERROR: ${e.message}`);
    }
}

await prisma.$disconnect();
