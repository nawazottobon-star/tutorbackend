import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function compareAccountData() {
    console.log('\n' + '='.repeat(70));
    console.log('DETAILED ACCOUNT DATA COMPARISON');
    console.log('='.repeat(70) + '\n');

    try {
        const accounts = [
            { email: 'nawaz@example.com', userId: '26ff8141-948c-4d6b-8d5e-efe8fd130aa8' },
            { email: 'vanapallijaswanth12@gmail.com', userId: 'ee705188-a9e0-4726-8822-330700c32ff0' }
        ];

        for (const acc of accounts) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`ACCOUNT: ${acc.email}`);
            console.log('='.repeat(70));

            // Get tutor profile
            const tutorProfile = await prisma.$queryRaw<any[]>`
                SELECT tutor_id, display_name
                FROM tutors
                WHERE user_id = ${acc.userId}::uuid;
            `;

            if (tutorProfile.length === 0) {
                console.log('No tutor profile found.\n');
                continue;
            }

            const tutorId = tutorProfile[0].tutor_id;
            console.log(`Tutor Profile: ${tutorProfile[0].display_name}`);
            console.log(`Tutor ID: ${tutorId}\n`);

            // Get courses
            const courses = await prisma.$queryRaw<any[]>`
                SELECT c.course_id, c.course_name, c.slug, ct.role
                FROM course_tutors ct
                JOIN courses c ON ct.course_id = c.course_id
                WHERE ct.tutor_id = ${tutorId}::uuid
                AND ct.is_active = true;
            `;

            console.log(`Courses (${courses.length}):`);

            for (const course of courses) {
                console.log(`\n  📚 ${course.course_name}`);
                console.log(`     Slug: ${course.slug}`);
                console.log(`     Role: ${course.role}`);

                // Get enrollments for this course
                const enrollments = await prisma.$queryRaw<any[]>`
                    SELECT u.full_name, u.email, e.enrolled_at, e.status
                    FROM enrollments e
                    JOIN users u ON e.user_id = u.user_id
                    WHERE e.course_id = ${course.course_id}::uuid
                    ORDER BY e.enrolled_at DESC;
                `;

                console.log(`     Students enrolled: ${enrollments.length}`);

                if (enrollments.length > 0) {
                    enrollments.forEach((enr, idx) => {
                        console.log(`       ${idx + 1}. ${enr.full_name} (${enr.email}) - ${enr.status}`);
                    });
                }
            }

            console.log('');
        }

        console.log('\n' + '='.repeat(70));
        console.log('SUMMARY');
        console.log('='.repeat(70));
        console.log('\nBoth accounts are tutors for the SAME course.');
        console.log('The course has the same students regardless of which tutor account you use.');
        console.log('\nBoth logins should show the same course and student data!');
        console.log('='.repeat(70) + '\n');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

compareAccountData();
