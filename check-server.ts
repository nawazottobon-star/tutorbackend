// Simple test to check if backend is running
const API_URL = 'http://localhost:3000';

async function checkServer() {
    console.log(`\nChecking if backend server is running at ${API_URL}...\n`);

    try {
        const response = await fetch(`${API_URL}/api/health`, {
            method: 'GET',
        });
        console.log(`✅ Server is running! Status: ${response.status}`);
        const data = await response.text();
        console.log(`Response: ${data}\n`);
    } catch (error: any) {
        console.log(`❌ Server is NOT running`);
        console.log(`Error: ${error.message}\n`);
        console.log('Please start the backend server with: npm run dev');
        console.log('(You may need to run this in a separate terminal)\n');
    }
}

checkServer();
