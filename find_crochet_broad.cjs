const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findCrochetInWorkshops() {
  try {
    console.log('--- Searching ALL Workshops and their Offerings ---');
    const allWorkshops = await prisma.workshop.findMany({
      include: {
        offering: true
      }
    });
    
    const crochetWorkshops = allWorkshops.filter(w => 
      w.offering.title.toLowerCase().includes('crochet')
    );

    console.log('Crochet Workshops found:', JSON.stringify(crochetWorkshops, null, 2));

    console.log('\n--- Searching ALL Offerings with titles like Crochet ---');
    const crochetOfferings = await prisma.courseOffering.findMany({
      where: {
        title: { contains: 'crochet', mode: 'insensitive' }
      }
    });
    console.log('Crochet Offerings found:', JSON.stringify(crochetOfferings, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findCrochetInWorkshops();
