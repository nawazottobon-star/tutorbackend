const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function countAllPrompts() {
    try {
        const courseId = "f26180b2-5dda-495a-a014-ae02e63f172f"; // AI Native FullStack Developer
        
        console.log("Analyzing Course: AI Native FullStack Developer");
        
        const totalPrompts = await prisma.coldCallPrompt.count({
            where: { courseId: courseId }
        });

        const totalTopics = await prisma.topic.count({
            where: { courseId: courseId }
        });

        const moduleStats = await prisma.topic.groupBy({
            by: ['moduleNo'],
            where: { courseId: courseId },
            _count: {
                topicId: true
            },
            orderBy: {
                moduleNo: 'asc'
            }
        });

        console.log(`\nTotal Cold Call Prompts in Database: ${totalPrompts}`);
        console.log(`Total Topics in Course: ${totalTopics}`);
        
        console.log("\nModule Breakdown:");
        for (const mod of moduleStats) {
            const promptCount = await prisma.coldCallPrompt.count({
                where: { 
                    courseId: courseId,
                    topic: { moduleNo: mod.moduleNo }
                }
            });
            console.log(`Module ${mod.moduleNo}: ${mod._count.topicId} Topics, ${promptCount} Prompts`);
        }

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

countAllPrompts();
