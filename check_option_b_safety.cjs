const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDb() {
    try {
        console.log("Checking database tables for safety...");

        // Check Workshops
        const workshops = await prisma.workshop.findMany();
        console.log(`\nFound ${workshops.length} workshops.`);
        if (workshops.length > 0) {
            console.log("Sample Workshop:", workshops[0]);
        }

        // Check Sessions
        const sessions = await prisma.workshopSession.findMany();
        console.log(`\nFound ${sessions.length} sessions.`);
        if (sessions.length > 0) {
            console.log("Sample Session:", sessions[0]);
        }

        // We will do a raw SQL check just like before
        const rawCounts = await prisma.$queryRawUnsafe(`
      select relname, n_live_tup 
      from pg_stat_user_tables 
      where relname in ('workshops', 'WorkshopSession');
    `);
        console.log("\nRaw counts from pg_stat_user_tables:", rawCounts);

    } catch (error) {
        console.error("Error checking db:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDb();
