const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const res = await prisma.$queryRawUnsafe(`
      SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public';
    `);
        console.log(res);

        // Let's also check current user
        const user = await prisma.$queryRawUnsafe(`SELECT current_user;`);
        console.log("Current User:", user);
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}
check();
