const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const regs = await prisma.$queryRaw`
        SELECT registration_id, full_name, answers_json 
        FROM registrations 
        ORDER BY created_at DESC 
        LIMIT 5;
    `;
    
    for (const r of regs) {
        console.log(`\n=== ${r.full_name} ===`);
        console.log('Type of answers_json:', typeof r.answers_json);
        console.log('Raw value:', JSON.stringify(r.answers_json, null, 2));
    }

    await prisma.$disconnect();
}

main().catch(console.error);
