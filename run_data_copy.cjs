const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runDataCopy() {
    try {
        console.log("Copying data from workshops to workshop_sessions...");
        await prisma.$executeRawUnsafe(`
      UPDATE "workshop_sessions" ws
      SET 
        "google_meet_link" = w."google_meet_link",
        "max_seats" = w."max_seats"
      FROM "workshops" w
      WHERE ws."offering_id" = w."offering_id"
      AND ws."google_meet_link" IS NULL;
    `);
        console.log("Update completed.");

        console.log("\nVerifying the copied data...");
        const sessions = await prisma.$queryRawUnsafe(`
      SELECT "session_id", "session_no", "google_meet_link", "max_seats" 
      FROM "workshop_sessions"
    `);

        console.log("Found sessions after update:");
        console.log(sessions);

        console.log("\n✅ Data Copy complete. The original workshops table was NOT modified.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runDataCopy();
