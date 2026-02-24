import { PrismaClient } from '@prisma/client';
import { verifyPassword } from './src/utils/password';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function testLogin(email: string, password: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing login for: ${email}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        // Step 1: Find user
        const user = await prisma.$queryRaw<any[]>`
            SELECT user_id, email, full_name, role, password_hash
            FROM users
            WHERE email = ${email.toLowerCase().trim()};
        `;

        if (user.length === 0) {
            console.log('❌ FAIL: User not found in database');
            return;
        }

        console.log('✅ Step 1: User found');
        console.log(`   Email: ${user[0].email}`);
        console.log(`   Name: ${user[0].full_name}`);
        console.log(`   Role: ${user[0].role}`);
        console.log(`   Password Hash: ${user[0].password_hash.substring(0, 60)}...`);

        // Step 2: Check role
        if (user[0].role === 'learner') {
            console.log('❌ FAIL: User is a learner, not tutor/admin');
            return;
        }

        console.log('✅ Step 2: Role check passed (tutor/admin)');

        // Step 3: Verify password
        const passwordValid = await verifyPassword(password, user[0].password_hash);

        if (!passwordValid) {
            console.log('❌ FAIL: Password verification failed');
            console.log(`   Provided password: "${password}"`);
            console.log(`   Password length: ${password.length}`);
            return;
        }

        console.log('✅ Step 3: Password verified successfully');
        console.log('\n🎉 LOGIN SUCCESSFUL! All checks passed.\n');

    } catch (e) {
        console.error('❌ Error during login test:', e);
    }
}

async function main() {
    console.log('Testing Tutor Login Authentication');
    console.log('====================================\n');

    // Test each tutor account with common passwords
    const testCases = [
        { email: 'nawaz@example.com', password: 'password123' },
        { email: 'nawaz@example.com', password: 'admin123' },
        { email: 'vanapallijaswanth12@gmail.com', password: 'password123' },
        { email: 'jaswanthvanapalli12@gmail.com', password: 'admin123' },
    ];

    for (const testCase of testCases) {
        await testLogin(testCase.email, testCase.password);
    }

    console.log('\n' + '='.repeat(60));
    console.log('INSTRUCTIONS:');
    console.log('='.repeat(60));
    console.log('If all tests failed, you need to know the correct password.');
    console.log('Please provide the password you are trying to use, and I can');
    console.log('help you either verify it or reset it.');
    console.log('='.repeat(60) + '\n');

    await prisma.$disconnect();
}

main();
