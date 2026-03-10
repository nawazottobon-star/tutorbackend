const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDbRelations() {
    try {
        const sessions = await prisma.workshopSession.findMany({
            include: { offering: { include: { workshop: true } } }
        });

        console.log("Sessions with their Workshop Links:");
        sessions.forEach(s => {
            console.log(`Session ${s.sessionNo} -> Link: ${s.offering?.workshop?.googleMeetLink}, Seats: ${s.offering?.workshop?.maxSeats}`);
        });

    } catch (error) {
        console.error("Error checking db:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDbRelations();
