const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEnums() {
    try {
        console.log("Checking exact ENUM values used by ProgramType...");
        const enums = await prisma.$queryRaw`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE typname = 'ProgramType';
        `;
        console.table(enums);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
checkEnums();
