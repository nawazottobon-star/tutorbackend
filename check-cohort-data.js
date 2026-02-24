import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkCohortData() {
    try {
        console.log('\n🔍 Checking Cohort 1 learner data...\n');

        // Find Cohort 1
        const cohort = await prisma.cohort.findFirst({
            where: { name: 'Cohort 1' },
            select: { cohortId: true, courseId: true, name: true }
        });

        if (!cohort) {
            console.log('❌ Cohort 1 not found');
            return;
        }

        console.log(`✅ Found: ${cohort.name} (ID: ${cohort.cohortId})`);
        console.log(`   Course ID: ${cohort.courseId}\n`);

        // Get total modules
        const maxModule = await prisma.topic.aggregate({
            where: { courseId: cohort.courseId, moduleNo: { gt: 0 } },
            _max: { moduleNo: true },
        });
        const totalModules = maxModule._max.moduleNo || 8;
        console.log(`📚 Total modules in course: ${totalModules}\n`);

        // Get cohort members
        const members = await prisma.cohortMember.findMany({
            where: { cohortId: cohort.cohortId },
            include: {
                user: {
                    select: { fullName: true, userId: true }
                }
            }
        });

        console.log(`👥 Cohort members: ${members.length}\n`);

        // Get progress for each member
        for (const member of members) {
            const displayName = member.user?.fullName || member.email.split('@')[0];

            if (!member.userId) {
                console.log(`   ${displayName}: No userId (not enrolled)`);
                continue;
            }

            // Get module progress
            const progressCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM module_progress
        WHERE user_id::text = ${member.userId}
        AND course_id::text = ${cohort.courseId}
        AND quiz_passed = true
      `;

            const completed = Number(progressCount[0]?.count || 0);
            const percent = Math.floor((completed / totalModules) * 100);

            console.log(`   ${displayName}: ${percent}% (${completed}/${totalModules} modules)`);
        }

        console.log('\n✅ Data check complete\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkCohortData();
