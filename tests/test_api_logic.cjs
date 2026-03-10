const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testApiLogic() {
    const userId = 'ee705188-a9e0-4726-8822-330700c32ff0'; // The ID for Jaswanth

    console.log(`Testing course fetch for userId: ${userId}`);

    const courses = await prisma.courseTutor.findMany({
        where: {
            isActive: true,
            tutor: { userId: userId },
        },
        include: {
            course: {
                select: {
                    courseId: true,
                    courseName: true,
                    slug: true,
                    description: true,
                },
            },
        },
    });

    console.log('Result length:', courses.length);
    console.log('Result data:', JSON.stringify(courses, null, 2));
}

testApiLogic()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
