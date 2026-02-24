import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const COURSE_ID = 'f26180b2-5dda-495a-a014-ae02e63f172f';

async function main() {
    try {
        console.log('--- DIAGNOSIS START ---');

        // 1. Check Course
        const course = await prisma.course.findUnique({ where: { courseId: COURSE_ID } });
        console.log('Course found:', course?.courseName || 'NOT FOUND');

        // 2. Check Topics
        const topicsCount = await prisma.topic.count({ where: { courseId: COURSE_ID } });
        console.log('Total Topics for course:', topicsCount);

        const modulesWithTopics = await prisma.topic.groupBy({
            by: ['moduleNo'],
            where: { courseId: COURSE_ID, moduleNo: { gt: 0 } },
            _count: true,
        });
        console.log('Modules with topics (>0):', modulesWithTopics);

        // 3. Check Cohorts
        const cohorts = await prisma.cohort.findMany({ where: { courseId: COURSE_ID } });
        console.log('Cohorts found:', cohorts.map(c => ({ id: c.cohortId, name: c.name })));

        if (cohorts.length > 0) {
            for (const cohort of cohorts) {
                console.log(`\nChecking Cohort: ${cohort.name} (${cohort.cohortId})`);

                const members = await prisma.cohortMember.findMany({ where: { cohortId: cohort.cohortId } });
                console.log('Members count:', members.length);
                console.log('Members table IDs:', members.map(m => `MemberID: ${m.memberId}, UserID: ${m.userId}`).join('\n'));

                const userIds = members.map(m => m.userId).filter((id): id is string => id !== null);
                console.log('Valid UserIDs for progress check:', userIds);

                if (userIds.length > 0) {
                    // 4. Check Progress Records
                    const progressRecords = await prisma.$queryRaw<any[]>`
                        SELECT count(*) as count FROM module_progress 
                        WHERE course_id = ${COURSE_ID}::uuid 
                        AND user_id = ANY(${userIds}::uuid[])
                    `.catch(err => {
                        console.error('Progress query failed:', err.message);
                        return [];
                    });

                    // Also lets dump the raw progress rows for these users to be sure
                    const rawRows = await prisma.$queryRaw<any[]>`
                        SELECT user_id, module_no, quiz_passed FROM module_progress 
                        WHERE course_id = ${COURSE_ID}::uuid 
                        AND user_id = ANY(${userIds}::uuid[])
                    `.catch(err => []);

                    console.log(`Progress count for cohort members:`, progressRecords[0]?.count || 0);
                    console.log('Sample progress sample:', rawRows.slice(0, 3));
                } else {
                    console.log('No valid user IDs in this cohort to check progress for.');
                }
            }
        }

        console.log('--- DIAGNOSIS END ---');
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
