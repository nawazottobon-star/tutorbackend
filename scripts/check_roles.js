import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
        where: { email: 'nawazottobon@gmail.com' }
    });
    console.log('User status for nawazottobon:');
    console.log(JSON.stringify(user, null, 2));

    const userNew = await prisma.user.findUnique({
        where: { email: 'nawaz12@gmail.com' }
    });
    console.log('\nUser status for nawaz12:');
    console.log(JSON.stringify(userNew, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
