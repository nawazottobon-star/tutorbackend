const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    try {
        const name = 'MEESALA SIDDHARTHA';
        console.log('Searching for name:', name);

        const users = await prisma.user.findMany({
            where: { fullName: { contains: name, mode: 'insensitive' } }
        });

        console.log('--- USERS FOUND ---');
        console.log(JSON.stringify(users, null, 2));

        for (const user of users) {
            const cohorts = await prisma.cohortMember.findMany({
                where: { userId: user.userId },
                include: { cohort: true }
            });
            console.log(`\n--- COHORTS FOR ${user.fullName} ---`);
            console.log(JSON.stringify(cohorts, null, 2));

            const progressCount = await prisma.$queryRawUnsafe(
                'SELECT COUNT(*) as count FROM module_progress WHERE user_id::text = $1 AND quiz_passed = true',
                user.userId
            );
            console.log(`PROGRESS: ${progressCount[0].count} modules passed`);
        }

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
