const { PrismaClient } = require('./node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function backupData() {
    try {
        const courseId = "f26180b2-5dda-495a-a014-ae02e63f172f"; // AI Native FullStack Developer
        
        console.log("Backing up Cold Call Prompts for AI Native FullStack Developer...");
        
        const prompts = await prisma.coldCallPrompt.findMany({
            where: { courseId: courseId }
        });

        const backupPath = path.join(__dirname, 'cold_call_backup_ORIGINAL.json');
        fs.writeFileSync(backupPath, JSON.stringify(prompts, null, 2));

        console.log(`\n✅ Backup Successful! Saved ${prompts.length} prompts to:`);
        console.log(backupPath);

    } catch (err) {
        console.error("❌ Backup Failed:", err.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

backupData();
