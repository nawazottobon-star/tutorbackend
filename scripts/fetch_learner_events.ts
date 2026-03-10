import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$queryRawUnsafe<{ event_type: string; count: bigint }[]>(`
    SELECT event_type, COUNT(*) as count
    FROM learner_activity_events
    GROUP BY event_type
    ORDER BY count DESC;
  `);

    console.log('\n========================================');
    console.log('   DISTINCT EVENT TYPES');
    console.log('========================================');
    console.log(`\nTotal unique event types: ${result.length}\n`);
    console.table(result.map(r => ({ event_type: r.event_type, count: r.count.toString() })));
}

main()
    .catch((e) => { console.error('ERROR:', e.message); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
