const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const members1 = await prisma.cohortMember.findMany({
        where: { cohort: { name: 'Cohort 1' } },
        select: { userId: true, user: { select: { email: true } } }
    });

    const userIds1 = members1.map(m => m.userId).filter(Boolean);

    console.log("Cohort 1 Members:", members1.length);

    if (userIds1.length > 0) {
        const prog1 = await prisma.$queryRawUnsafe(`SELECT user_id, module_no, quiz_passed FROM module_progress WHERE user_id::text IN (${userIds1.map(id => `'${id}'`).join(',')})`);

        // Calculate progress for each user
        const userModules = {};
        for (const p of prog1) {
            if (p.quiz_passed) {
                if (!userModules[p.user_id]) userModules[p.user_id] = new Set();
                userModules[p.user_id].add(p.module_no);
            }
        }

        let totalPercent = 0;
        for (const m of members1) {
            if (!m.userId) continue;
            const count = userModules[m.userId] ? userModules[m.userId].size : 0;
            const percent = Math.floor((count / 8) * 100);
            console.log(`User ${m.user?.email || 'Unknown'}: ${count} modules passed, ${percent}%`);
            totalPercent += percent;
        }

        const avg = Math.floor(totalPercent / members1.length);
        console.log(`\nAverage percent = Math.floor(${totalPercent} / ${members1.length}) = ${avg}%`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
