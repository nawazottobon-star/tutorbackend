const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== FIXING NULL VALUES IN REGISTRATIONS ===');
    
    // We use queryRaw because Prisma won't even let us find these rows easily without crashing if they violate schema
    const rawUpdate = await prisma.$executeRaw`
        UPDATE registrations 
        SET college_name = COALESCE(college_name, 'N/A'),
            year_of_passing = COALESCE(year_of_passing, 'N/A'),
            branch = COALESCE(branch, 'N/A')
        WHERE college_name IS NULL 
           OR year_of_passing IS NULL 
           OR branch IS NULL;
    `;
    
    console.log(`Updated ${rawUpdate} rows.`);

    // Now try to fetch normally using Prisma
    const regs = await prisma.registration.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    
    console.table(regs.map(r => ({
        id: r.registrationId,
        name: r.fullName,
        email: r.email,
        college: r.collegeName,
        createdAt: r.createdAt
    })));

    await prisma.$disconnect();
}

main().catch(console.error);
