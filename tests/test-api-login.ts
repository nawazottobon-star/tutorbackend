import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';

async function testLoginAPI() {
    console.log('\n' + '='.repeat(70));
    console.log('TESTING TUTOR LOGIN API ENDPOINT');
    console.log('='.repeat(70));
    console.log(`API URL: ${API_URL}\n`);

    const testCases = [
        {
            email: 'vanapallijaswanth12@gmail.com',
            password: 'YourNewPassword123',
            description: 'Jaswanth account with correct password'
        },
        {
            email: 'nawaz@example.com',
            password: 'tutor123',
            description: 'Nawaz account'
        }
    ];

    for (const testCase of testCases) {
        console.log(`Testing: ${testCase.description}`);
        console.log(`  Email: ${testCase.email}`);
        console.log(`  Password: ${testCase.password}`);

        try {
            const response = await fetch(`${API_URL}/api/tutors/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: testCase.email,
                    password: testCase.password
                })
            });

            console.log(`  Status: ${response.status} ${response.statusText}`);

            const data = await response.json();

            if (response.ok) {
                console.log('  ✅ LOGIN SUCCESSFUL!');
                console.log(`     User: ${data.user?.fullName} (${data.user?.email})`);
                console.log(`     Role: ${data.user?.role}`);
                console.log(`     Session ID: ${data.session?.sessionId?.substring(0, 20)}...`);
            } else {
                console.log('  ❌ LOGIN FAILED');
                console.log(`     Error: ${data.message || JSON.stringify(data)}`);
            }
        } catch (error: any) {
            console.log('  ❌ REQUEST ERROR');
            console.log(`     ${error.message}`);
        }

        console.log('');
    }

    console.log('='.repeat(70) + '\n');
}

testLoginAPI();
