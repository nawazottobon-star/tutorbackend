import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const topics = await prisma.topic.findMany({ 
    take: 10, 
    select: { 
      topicId: true, 
      topicName: true, 
      contentType: true,
      simulation: { select: { exerciseId: true } },
      coldCallPrompts: { select: { promptId: true }, take: 1 }
    } 
  });
  console.log(JSON.stringify(topics, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
