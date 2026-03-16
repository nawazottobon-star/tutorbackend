const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCrochet() {
  try {
    console.log('--- Checking for tutor Jaswanth ---');
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { fullName: { contains: 'Jaswanth', mode: 'insensitive' } },
          { email: { contains: 'Jaswanth', mode: 'insensitive' } }
        ]
      },
      include: {
        tutorProfile: true
      }
    });
    console.log('Users found:', JSON.stringify(users, null, 2));

    const tutorIds = users.filter(u => u.tutorProfile).map(u => u.tutorProfile.tutorId);
    console.log('Tutor IDs:', tutorIds);

    console.log('\n--- Checking for Crochet workshop ---');
    const offerings = await prisma.courseOffering.findMany({
      where: {
        title: { contains: 'crochet', mode: 'insensitive' }
      },
      include: {
        workshop: {
          include: {
            tutor: {
              include: {
                user: true
              }
            }
          }
        },
        workshopSessions: true
      }
    });
    console.log('Offerings found:', JSON.stringify(offerings, null, 2));

    if (tutorIds.length > 0) {
      console.log('\n--- Workshops assigned to Jaswanth\'s Tutor IDs ---');
      const workshopsByTutor = await prisma.workshop.findMany({
        where: {
          tutorId: { in: tutorIds }
        },
        include: {
          offering: true
        }
      });
      console.log('Workshops found by tutorId:', JSON.stringify(workshopsByTutor, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCrochet();
