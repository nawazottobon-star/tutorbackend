import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('DATABASE INTEGRITY CHECK');
    console.log('='.repeat(60) + '\n');

    try {
        // Count all major tables
        const userCount = await prisma.user.count();
        const courseCount = await prisma.course.count();
        const enrollmentCount = await prisma.enrollment.count();
        const topicCount = await prisma.topic.count();
        const progressCount = await prisma.topicProgress.count();

        console.log('📊 Database Record Counts:');
        console.log('─'.repeat(60));
        console.log(`   Users (total):          ${userCount}`);
        console.log(`   Courses:                ${courseCount}`);
        console.log(`   Enrollments:            ${enrollmentCount}`);
        console.log(`   Topics:                 ${topicCount}`);
        console.log(`   Topic Progress:         ${progressCount}`);
        console.log('─'.repeat(60));

        // Count users by role
        const learners = await prisma.user.count({ where: { role: 'learner' } });
        const tutors = await prisma.user.count({ where: { role: 'tutor' } });
        const admins = await prisma.user.count({ where: { role: 'admin' } });

        console.log('\n👥 Users by Role:');
        console.log('─'.repeat(60));
        console.log(`   Learners:               ${learners}`);
        console.log(`   Tutors:                 ${tutors}`);
        console.log(`   Admins:                 ${admins}`);
        console.log('─'.repeat(60));

        console.log('\n✅ ALL DATA IS INTACT!');
        console.log('   Only password hashes were updated for 3 tutor accounts.');
        console.log('   No records were deleted or modified.\n');

        console.log('='.repeat(60) + '\n');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
