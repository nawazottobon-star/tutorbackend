import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function compareAccountsFixed() {
    console.log('\n' + '='.repeat(70));
    console.log('COMPARING TWO ACCOUNTS');
    console.log('='.repeat(70) + '\n');

    try {
        // Get both accounts
        const accounts = await prisma.$queryRaw<any[]>`
            SELECT user_id, email, full_name, role, created_at
            FROM users
            WHERE email IN ('nawaz@example.com', 'vanapallijaswanth12@gmail.com')
            ORDER BY email;
        `;

        console.log('Found accounts:\n');
        accounts.forEach((acc, idx) => {
            console.log(`${idx + 1}. Email: ${acc.email}`);
            console.log(`   User ID: ${acc.user_id}`);
            console.log(`   Name: ${acc.full_name}`);
            console.log(`   Role: ${acc.role}`);
            console.log(`   Created: ${acc.created_at}\n`);
        });

        // Check which account has tutor profile
        for (const acc of accounts) {
            console.log(`Checking tutor data for ${acc.email}:`);

            // Check tutor profile (fix UUID casting)
            const tutorProfile = await prisma.$queryRaw<any[]>`
                SELECT tutor_id, display_name
                FROM tutors
                WHERE user_id = ${acc.user_id}::uuid;
            `;

            if (tutorProfile.length > 0) {
                console.log(`  ✅ Has tutor profile: ${tutorProfile[0].display_name}`);
                console.log(`     Tutor ID: ${tutorProfile[0].tutor_id}`);

                // Check courses for this tutor
                const courses = await prisma.$queryRaw<any[]>`
                    SELECT c.course_name, ct.role
                    FROM course_tutors ct
                    JOIN courses c ON ct.course_id = c.course_id
                    WHERE ct.tutor_id = ${tutorProfile[0].tutor_id}::uuid
                    AND ct.is_active = true;
                `;

                console.log(`  Courses assigned: ${courses.length}`);
                if (courses.length > 0) {
                    courses.forEach((course, idx) => {
                        console.log(`     ${idx + 1}. ${course.course_name} (${course.role})`);
                    });
                }
            } else {
                console.log(`  ❌ No tutor profile`);
            }

            // Check enrollments
            const enrollments = await prisma.$queryRaw<any[]>`
                SELECT COUNT(*) as count
                FROM enrollments
                WHERE user_id = ${acc.user_id}::uuid;
            `;

            console.log(`  Enrollments as student: ${enrollments[0].count}\n`);
        }

        console.log('='.repeat(70));
        console.log('SUMMARY');
        console.log('='.repeat(70));
        console.log('\nWhich account has your tutor data (courses, students)?');
        console.log('This will help me determine the correct action.\n');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

compareAccountsFixed();
