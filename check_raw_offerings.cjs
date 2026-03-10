const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRawOfferingsTable() {
    try {
        console.log("Checking raw columns in course_offerings...");

        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'course_offerings';
        `;
        console.table(columns);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
checkRawOfferingsTable();
