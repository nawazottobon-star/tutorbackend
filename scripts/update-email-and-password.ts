import { PrismaClient } from '@prisma/client';
import { hashPassword } from './src/utils/password';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function updateEmailAndPassword() {
    const oldEmail = 'nawaz@example.com';
    const newEmail = 'vanapallijaswanth12@gmail.com';
    const newPassword = 'YourNewPassword123';

    console.log('\n' + '='.repeat(70));
    console.log('UPDATING EMAIL AND PASSWORD');
    console.log('='.repeat(70));
    console.log(`Old Email: ${oldEmail}`);
    console.log(`New Email: ${newEmail}`);
    console.log(`New Password: ${newPassword}`);
    console.log('='.repeat(70) + '\n');

    try {
        // Step 1: Check if old email exists
        console.log('Step 1: Checking if old email exists...');
        const oldUser = await prisma.$queryRaw<any[]>`
            SELECT user_id, email, full_name, role
            FROM users
            WHERE email = ${oldEmail};
        `;

        if (oldUser.length === 0) {
            console.log(`❌ ERROR: ${oldEmail} not found!`);
            return;
        }

        console.log(`✅ Found user: ${oldUser[0].full_name} (${oldUser[0].role})`);
        console.log(`   User ID: ${oldUser[0].user_id}\n`);

        // Step 2: Check if new email already exists
        console.log('Step 2: Checking if new email already exists...');
        const existingUser = await prisma.$queryRaw<any[]>`
            SELECT user_id, email
            FROM users
            WHERE email = ${newEmail};
        `;

        if (existingUser.length > 0) {
            console.log(`⚠️  WARNING: ${newEmail} already exists!`);
            console.log(`   This account will need to be handled separately.\n`);
        } else {
            console.log(`✅ ${newEmail} is available\n`);
        }

        // Step 3: Hash new password
        console.log('Step 3: Hashing new password...');
        const passwordHash = await hashPassword(newPassword);
        console.log('✅ Password hashed successfully\n');

        // Step 4: Update email and password
        console.log('Step 4: Updating email and password in database...');
        const result = await prisma.$executeRaw`
            UPDATE users
            SET email = ${newEmail},
                password_hash = ${passwordHash}
            WHERE email = ${oldEmail};
        `;

        if (result === 0) {
            console.log('❌ ERROR: No rows updated!');
            return;
        }

        console.log(`✅ Successfully updated ${result} row(s)\n`);

        // Step 5: Verify the update
        console.log('Step 5: Verifying update...');
        const updatedUser = await prisma.$queryRaw<any[]>`
            SELECT user_id, email, full_name, role,
                   SUBSTRING(password_hash, 1, 30) as hash_preview
            FROM users
            WHERE user_id = ${oldUser[0].user_id};
        `;

        console.log('✅ Verification successful:');
        console.log(`   Email: ${updatedUser[0].email}`);
        console.log(`   Name: ${updatedUser[0].full_name}`);
        console.log(`   Role: ${updatedUser[0].role}`);
        console.log(`   Hash: ${updatedUser[0].hash_preview}...\n`);

        // Step 6: Check if old email still exists
        console.log('Step 6: Confirming old email no longer exists...');
        const oldEmailCheck = await prisma.$queryRaw<any[]>`
            SELECT email FROM users WHERE email = ${oldEmail};
        `;

        if (oldEmailCheck.length === 0) {
            console.log(`✅ ${oldEmail} no longer exists in database\n`);
        } else {
            console.log(`⚠️  WARNING: ${oldEmail} still exists!\n`);
        }

        console.log('='.repeat(70));
        console.log('✅ UPDATE COMPLETE!');
        console.log('='.repeat(70));
        console.log('\nNew login credentials:');
        console.log(`   Email: ${newEmail}`);
        console.log(`   Password: ${newPassword}`);
        console.log('\n' + '='.repeat(70) + '\n');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

updateEmailAndPassword();
