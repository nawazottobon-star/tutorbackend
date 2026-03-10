const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
    try {
        console.log("Attempting database connection...");
        await prisma.$connect();
        console.log("Connected successfully!");

        console.log("Attempting a query...");
        const count = await prisma.user.count();
        console.log(`Query successful. Total users: ${count}`);
    } catch (err) {
        console.error("Connection failed:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
