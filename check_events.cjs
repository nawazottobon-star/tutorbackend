const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEvents() {
    try {
        const email = 'siddhumeesala3@gmail.com';
        const user = await prisma.user.findFirst({ where: { email } });
        if (!user) {
            console.log('User not found');
            return;
        }

        const events = await prisma.learnerActivityEvent.findMany({
            where: { userId: user.userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        console.log(`--- LAST 20 EVENTS FOR ${user.fullName} ---`);
        console.log(JSON.stringify(events, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkEvents();
