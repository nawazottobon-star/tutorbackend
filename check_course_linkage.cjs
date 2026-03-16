const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCourseLinkage() {
  try {
    const offeringId = 'a6a1c8fa-46c4-4787-9514-0a047bf8f408'; // Crochet Offering ID
    
    console.log(`--- Checking Offering ${offeringId} (Crochet) ---`);
    const offering = await prisma.courseOffering.findUnique({
      where: { offeringId: offeringId },
      include: {
        course: {
          include: {
            tutors: {
              include: {
                tutor: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    console.log('Offering Details:', JSON.stringify(offering, null, 2));

    if (offering && offering.course) {
      console.log('\n--- Tutors for Course:', offering.course.courseName, '---');
      offering.course.tutors.forEach(ct => {
        console.log(`- Tutor Name: ${ct.tutor.displayName}, Email: ${ct.tutor.user.email}, Role: ${ct.role}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCourseLinkage();
