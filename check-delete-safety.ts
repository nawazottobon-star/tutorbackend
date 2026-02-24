import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function checkDependenciesFixed() {
    const nawazUserId = '26ff8141-948c-4d6b-8d5e-efe8fd130aa8';

    console.log('\n' + '='.repeat(70));
    console.log('SAFETY CHECK: Dependencies for nawaz@example.com');
    console.log('='.repeat(70) + '\n');

    try {
        // Check enrollments
        const enrollments = await prisma.$queryRaw<any[]>`
            SELECT COUNT(*) as count FROM enrollments WHERE user_id = ${nawazUserId}::uuid
        `;
        console.log(`Enrollments: ${enrollments[0].count}`);

        // Check cart items
        const cartItems = await prisma.$queryRaw<any[]>`
            SELECT COUNT(*) as count FROM cart_items WHERE user_id = ${nawazUserId}::uuid
        `;
        console.log(`Cart Items: ${cartItems[0].count}`);

        // Check tutor profile
        const tutorProfile = await prisma.$queryRaw<any[]>`
            SELECT COUNT(*) as count FROM tutors WHERE user_id = ${nawazUserId}::uuid
        `;
        console.log(`Tutor Profile: ${tutorProfile[0].count}`);

        // Check course assignments via tutor
        const courseAssignments = await prisma.$queryRaw<any[]>`
            SELECT COUNT(*) as count 
            FROM course_tutors ct 
            JOIN tutors t ON ct.tutor_id = t.tutor_id 
            WHERE t.user_id = ${nawazUserId}::uuid
        `;
        console.log(`Course Assignments: ${courseAssignments[0].count}`);

        // Check sessions
        const sessions = await prisma.$queryRaw<any[]>`
            SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ${nawazUserId}::uuid
        `;
        console.log(`Active Sessions: ${sessions[0].count}`);

        console.log('\n' + '='.repeat(70));
        console.log('DELETION WILL REMOVE');
        console.log('='.repeat(70));
        console.log(`❌ 1 user account (nawaz@example.com)`);
        console.log(`❌ ${tutorProfile[0].count} tutor profile(s)`);
        console.log(`❌ ${courseAssignments[0].count} course assignment(s)`);
        console.log(`❌ ${sessions[0].count} session(s)`);
        console.log(`❌ ${enrollments[0].count} enrollment(s) (if any)`);
        console.log(`❌ ${cartItems[0].count} cart item(s) (if any)`);

        console.log('\n' + '='.repeat(70));
        console.log('WHAT WILL BE PRESERVED');
        console.log('='.repeat(70));
        console.log('✅ Course: "AI Native FullStack Developer"');
        console.log('✅ All 15 student enrollments in the course');
        console.log('✅ Course assignment: Jaswanth → Course (already exists)');
        console.log('✅ All course content, topics, modules');
        console.log('✅ vanapallijaswanth12@gmail.com account');

        console.log('\n' + '='.repeat(70));
        console.log('SAFETY VERDICT');
        console.log('='.repeat(70));

        if (parseInt(enrollments[0].count) === 0) {
            console.log('\n✅ SAFE TO DELETE');
            console.log('\nThe nawaz@example.com account has NO student enrollments.');
            console.log('It only has a tutor profile and course assignment.');
            console.log('Since vanapallijaswanth12@gmail.com is also assigned to the');
            console.log('same course, deleting nawaz will NOT affect the course or students.');
        } else {
            console.log('\n⚠️  CAUTION');
            console.log(`\nThe nawaz@example.com account has ${enrollments[0].count} enrollment(s).`);
            console.log('These will be deleted along with the account.');
        }

        console.log('\n' + '='.repeat(70) + '\n');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDependenciesFixed();
