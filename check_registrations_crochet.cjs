const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRegistrationsForCrochet() {
  try {
    const offeringId = 'a6a1c8fa-46c4-4787-9514-0a047bf8f408'; // Crochet Offering ID
    
    console.log(`--- Checking Registrations for Offering ${offeringId} (Crochet) ---`);
    const registrations = await prisma.registration.findMany({
      where: {
        offeringId: offeringId
      },
      include: {
        offering: true,
        session: true
      }
    });
    
    console.log('Registrations found:', JSON.stringify(registrations, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRegistrationsForCrochet();
