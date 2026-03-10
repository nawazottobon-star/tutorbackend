const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runSafeMigration() {
    try {
        console.log("Starting safe database migration...");

        console.log("Adding columns to workshop_sessions...");
        await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='workshop_sessions' AND column_name='google_meet_link') THEN
          ALTER TABLE "workshop_sessions" ADD COLUMN "google_meet_link" TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='workshop_sessions' AND column_name='max_seats') THEN
          ALTER TABLE "workshop_sessions" ADD COLUMN "max_seats" INTEGER;
        END IF;
      END $$;
    `);
        console.log("Columns added successfully.");

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

        console.log("\n✅ Migration complete. The original workshops table was NOT modified.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runSafeMigration();
