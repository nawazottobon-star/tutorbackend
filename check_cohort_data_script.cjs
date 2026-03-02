const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const members1 = await prisma.cohortMember.findMany({ where: { cohort: { name: 'Cohort 1' } }, select: { userId: true } });
  const members3 = await prisma.cohortMember.findMany({ where: { cohort: { name: 'Cohort 3 - Feb 19' } }, select: { userId: true } });

  const userIds1 = members1.map(m => m.userId).filter(Boolean);
  const userIds3 = members3.map(m => m.userId).filter(Boolean);

  if (userIds1.length > 0) {
    const prog1 = await prisma.$queryRawUnsafe(`SELECT user_id, module_no, quiz_passed FROM module_progress WHERE user_id::text IN (${userIds1.map(id => `'${id}'`).join(',')})`);
    console.log('Cohort 1 Progress:', prog1.length, 'rows');
    const active1 = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT user_id::text as user_id, MAX(updated_at) as last_activity
      FROM module_progress
      WHERE user_id::text IN (${userIds1.map(id => `'${id}'`).join(',')})
      GROUP BY user_id
    `);
    console.log('Cohort 1 Active Learners (from progress query):', active1.length);
  } else {
    console.log('Cohort 1: No members with userIds');
  }

  if (userIds3.length > 0) {
    const prog3 = await prisma.$queryRawUnsafe(`SELECT user_id, module_no, quiz_passed FROM module_progress WHERE user_id::text IN (${userIds3.map(id => `'${id}'`).join(',')})`);
    console.log('Cohort 3 Progress:', prog3.length, 'rows');
    const active3 = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT user_id::text as user_id, MAX(updated_at) as last_activity
      FROM module_progress
      WHERE user_id::text IN (${userIds3.map(id => `'${id}'`).join(',')})
      GROUP BY user_id
    `);
    console.log('Cohort 3 Active Learners (from progress query):', active3.length);
    const events3 = await prisma.learnerActivityEvent.findMany({
      where: { userId: { in: userIds3 } }
    });
    console.log('Cohort 3 Recent Events:', events3.length);
  } else {
    console.log('Cohort 3: No members with userIds');
  }

  // General enrollments check
  const allEnrollments = await prisma.enrollment.findMany({
    include: { user: { select: { fullName: true } } }
  });
  console.log('Total enrollments:', allEnrollments.length);
  const enrolledUserIds = allEnrollments.map(e => e.userId).filter(Boolean);
  if (enrolledUserIds.length > 0) {
    const allProg = await prisma.$queryRawUnsafe(`SELECT user_id, module_no, quiz_passed FROM module_progress WHERE user_id::text IN (${enrolledUserIds.map(id => `'${id}'`).join(',')})`);
    console.log('All Enrollments Progress:', allProg.length, 'rows');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
