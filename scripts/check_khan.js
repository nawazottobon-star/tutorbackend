import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const targetEmail = 'pathannawaz1610@gmail.com'; 
  try {
    const user = await prisma.user.findUnique({
        where: { email: targetEmail },
        include: {
            tutorProfile: true
        }
    });
    console.log('User status for pathannawaz1610:');
    console.log(JSON.stringify(user, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
