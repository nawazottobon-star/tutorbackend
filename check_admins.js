import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const allUsers = await prisma.user.findMany();
    const admins = allUsers.filter(u => u.role === 'admin');
    console.log('Admins:');
    console.log(JSON.stringify(admins, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
