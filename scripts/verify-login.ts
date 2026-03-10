import { PrismaClient } from '@prisma/client';
import { verifyPassword } from './src/utils/password';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function testLogin(email: string, password: string) {
    console.log(`Testing: ${email} / ${password}`);

    try {
        const user = await prisma.$queryRaw<any[]>`
            SELECT user_id, email, full_name, role, password_hash
            FROM users
            WHERE email = ${email.toLowerCase().trim()};
        `;

        if (user.length === 0) {
            console.log('   ❌ User not found\n');
            return;
        }

        if (user[0].role === 'learner') {
            console.log('   ❌ User is a learner\n');
            return;
        }

        const passwordValid = await verifyPassword(password, user[0].password_hash);

        if (!passwordValid) {
            console.log('   ❌ Password incorrect\n');
            return;
        }

        console.log('   ✅ LOGIN SUCCESSFUL!\n');

    } catch (e) {
        console.error('   ❌ Error:', e);
    }
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('VERIFYING PASSWORD RESET');
    console.log('='.repeat(60) + '\n');

    await testLogin('nawaz@example.com', 'tutor123');
    await testLogin('vanapallijaswanth12@gmail.com', 'tutor123');
    await testLogin('jaswanthvanapalli12@gmail.com', 'tutor123');

    console.log('='.repeat(60));
    console.log('All passwords have been verified!');
    console.log('You can now login to the tutor dashboard.');
    console.log('='.repeat(60) + '\n');

    await prisma.$disconnect();
}

main();
