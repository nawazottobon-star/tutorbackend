import { PrismaClient } from '@prisma/client';
import { hashPassword } from './src/utils/password';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function resetPassword(email: string, newPassword: string) {
    console.log(`\nResetting password for: ${email}`);
    console.log(`New password: ${newPassword}\n`);

    try {
        // Hash the new password
        const passwordHash = await hashPassword(newPassword);
        console.log('✅ Password hashed successfully');

        // Update the user's password
        const result = await prisma.$executeRaw`
            UPDATE users
            SET password_hash = ${passwordHash}
            WHERE email = ${email.toLowerCase().trim()};
        `;

        if (result === 0) {
            console.log('❌ User not found');
            return;
        }

        console.log('✅ Password updated successfully!\n');
        console.log('You can now login with:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${newPassword}\n`);

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('PASSWORD RESET UTILITY');
    console.log('='.repeat(60));

    // Reset passwords for all tutor accounts to a known password
    const newPassword = 'tutor123';

    await resetPassword('nawaz@example.com', newPassword);
    await resetPassword('vanapallijaswanth12@gmail.com', newPassword);
    await resetPassword('jaswanthvanapalli12@gmail.com', newPassword);

    console.log('='.repeat(60));
    console.log('ALL TUTOR PASSWORDS HAVE BEEN RESET TO: tutor123');
    console.log('='.repeat(60));
    console.log('\nYou can now login to the tutor dashboard with any of these:');
    console.log('  • nawaz@example.com / tutor123');
    console.log('  • vanapallijaswanth12@gmail.com / tutor123');
    console.log('  • jaswanthvanapalli12@gmail.com / tutor123');
    console.log('='.repeat(60) + '\n');

    await prisma.$disconnect();
}

main();
