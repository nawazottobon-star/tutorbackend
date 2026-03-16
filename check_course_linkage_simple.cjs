const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCourseLinkageSimple() {
  try {
    const offeringId = 'a6a1c8fa-46c4-4787-9514-0a047bf8f408'; // Crochet Offering ID
    
    console.log(`--- Checking Offering ${offeringId} (Crochet) ---`);
    const offering = await prisma.courseOffering.findUnique({
      where: { offeringId: offeringId },
      include: {
        course: true
      }
    });
    
    console.log('Offering Details:', JSON.stringify(offering, null, 2));

    if (offering && offering.course) {
        const courseId = offering.course.courseId;
        console.log('\n--- Checking Tutors for Course:', offering.course.courseName, `(${courseId}) ---`);
        const courseTutors = await prisma.courseTutor.findMany({
            where: { courseId: courseId }
        });
        console.log('Course Tutors Summary:', JSON.stringify(courseTutors, null, 2));

        for (const ct of courseTutors) {
            const tutor = await prisma.tutor.findUnique({
                where: { tutorId: ct.tutorId },
                include: { user: true }
            });
            if (tutor) {
                console.log(`- Tutor ID: ${tutor.tutorId}, Name: ${tutor.displayName}, User Email: ${tutor.user?.email || 'MISSING'}`);
            } else {
                console.log(`- Tutor ID: ${ct.tutorId} NOT FOUND in tutors table`);
            }
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCourseLinkageSimple();
