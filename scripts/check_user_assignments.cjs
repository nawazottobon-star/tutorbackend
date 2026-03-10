const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'vanapallijaswanth12@gmail.com';
    console.log(`Searching for user: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            tutorProfile: true
        }
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    console.log('User found:', JSON.stringify(user, null, 2));

    const assignments = await prisma.courseTutor.findMany({
        where: {
            tutor: { userId: user.userId }
        },
        include: {
            course: true
        }
    });

    console.log('Assignments count:', assignments.length);
    console.log('Assignments details:', JSON.stringify(assignments, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
