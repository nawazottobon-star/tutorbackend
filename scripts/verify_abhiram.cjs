const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    try {
        const email = 'abhiram.kota799@gmail.com';
        console.log('Searching for email:', email);

        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (!user) {
            console.log('User not found');
            return;
        }

        console.log('--- USER ---');
        console.log(JSON.stringify(user, null, 2));

        const cohorts = await prisma.cohortMember.findMany({
            where: { userId: user.userId },
            include: { cohort: true }
        });

        console.log('\n--- COHORTS ---');
        console.log(JSON.stringify(cohorts, null, 2));

        const progress = await prisma.$queryRawUnsafe(
            'SELECT * FROM module_progress WHERE user_id::text = $1',
            user.userId
        );

        console.log('\n--- PROGRESS ---');
        console.log(JSON.stringify(progress, null, 2));

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
