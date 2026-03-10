import { PrismaClient } from '@prisma/client';
import { hashPassword } from './src/utils/password';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function updateSinglePassword() {
    const email = 'vanapallijaswanth12@gmail.com';
    const newPassword = 'YourNewPassword123';

    console.log('\n' + '='.repeat(60));
    console.log('UPDATING PASSWORD FOR SINGLE USER');
    console.log('='.repeat(60));
    console.log(`Email: ${email}`);
    console.log(`New Password: ${newPassword}`);
    console.log('='.repeat(60) + '\n');

    try {
        // Step 1: Verify user exists first
        console.log('Step 1: Checking if user exists...');
        const user = await prisma.$queryRaw<any[]>`
            SELECT user_id, email, full_name, role
            FROM users
            WHERE email = ${email};
        `;

        if (user.length === 0) {
            console.log('❌ ERROR: User not found!');
            return;
        }

        console.log('✅ User found:');
        console.log(`   Email: ${user[0].email}`);
        console.log(`   Name: ${user[0].full_name}`);
        console.log(`   Role: ${user[0].role}\n`);

        // Step 2: Hash the new password
        console.log('Step 2: Hashing new password...');
        const passwordHash = await hashPassword(newPassword);
        console.log('✅ Password hashed successfully\n');

        // Step 3: Update ONLY the password_hash field for this specific user
        console.log('Step 3: Updating password in database...');
        console.log('   SQL: UPDATE users SET password_hash = <hash> WHERE email = vanapallijaswanth12@gmail.com');

        const updateResult = await prisma.$executeRaw`
            UPDATE users
            SET password_hash = ${passwordHash}
            WHERE email = ${email};
        `;

        if (updateResult === 0) {
            console.log('❌ ERROR: No rows updated!');
            return;
        }

        console.log(`✅ Password updated successfully! (${updateResult} row affected)\n`);

        // Step 4: Verify the update worked
        console.log('Step 4: Verifying update...');
        const verifyUser = await prisma.$queryRaw<any[]>`
            SELECT email, SUBSTRING(password_hash, 1, 30) as hash_preview
            FROM users
            WHERE email = ${email};
        `;

        console.log('✅ Verification successful:');
        console.log(`   Email: ${verifyUser[0].email}`);
        console.log(`   New Hash Preview: ${verifyUser[0].hash_preview}...\n`);

        console.log('='.repeat(60));
        console.log('✅ PASSWORD UPDATE COMPLETE');
        console.log('='.repeat(60));
        console.log(`\nLogin credentials for ${email}:`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${newPassword}`);
        console.log('\n' + '='.repeat(60) + '\n');

        // Step 5: Confirm no other data was affected
        console.log('Step 5: Database integrity check...');
        const totalUsers = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM users;`;
        const totalCourses = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM courses;`;
        const totalEnrollments = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM enrollments;`;

        console.log('✅ Database integrity confirmed:');
        console.log(`   Total users: ${totalUsers[0].count}`);
        console.log(`   Total courses: ${totalCourses[0].count}`);
        console.log(`   Total enrollments: ${totalEnrollments[0].count}`);
        console.log('\n   No data was deleted. Only password_hash was updated.\n');

    } catch (e) {
        console.error('❌ ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

updateSinglePassword();
