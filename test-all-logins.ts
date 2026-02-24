import { PrismaClient } from '@prisma/client';
import { verifyPassword } from './src/utils/password';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function testAllLogins() {
    console.log('\n' + '='.repeat(70));
    console.log('TESTING ALL TUTOR LOGINS');
    console.log('='.repeat(70) + '\n');

    const testCases = [
        { email: 'nawaz@example.com', password: 'tutor123' },
        { email: 'vanapallijaswanth12@gmail.com', password: 'YourNewPassword123' },
        { email: 'jaswanthvanapalli12@gmail.com', password: 'tutor123' },
    ];

    for (const test of testCases) {
        console.log(`Testing: ${test.email}`);
        console.log(`Password: ${test.password}`);

        try {
            const user = await prisma.$queryRaw<any[]>`
                SELECT user_id, email, full_name, role, password_hash
                FROM users
                WHERE email = ${test.email.toLowerCase().trim()};
            `;

            if (user.length === 0) {
                console.log('   ❌ User not found\n');
                continue;
            }

            console.log(`   ✅ User found: ${user[0].full_name} (${user[0].role})`);

            if (user[0].role === 'learner') {
                console.log('   ❌ User is a learner, not tutor/admin\n');
                continue;
            }

            const passwordValid = await verifyPassword(test.password, user[0].password_hash);

            if (!passwordValid) {
                console.log('   ❌ Password incorrect');
                console.log(`   Hash: ${user[0].password_hash.substring(0, 50)}...\n`);
                continue;
            }

            console.log('   ✅ Password correct');
            console.log('   🎉 LOGIN SUCCESSFUL!\n');

        } catch (e: any) {
            console.log(`   ❌ Error: ${e.message}\n`);
        }
    }

    console.log('='.repeat(70) + '\n');
}

testAllLogins();
