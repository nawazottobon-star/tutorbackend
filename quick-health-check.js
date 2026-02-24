// Quick health check for the backend server
import http from 'http';

const PORT = process.env.PORT || 4000;

console.log(`\n🔍 Checking if backend server is running on port ${PORT}...\n`);

const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
};

const req = http.request(options, (res) => {
    console.log(`✅ Server is RUNNING!`);
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Response: ${data}\n`);
        console.log('✅ Backend server is healthy and responding!\n');
    });
});

req.on('error', (error) => {
    console.log(`❌ Server is NOT running on port ${PORT}`);
    console.log(`Error: ${error.message}\n`);
    console.log('Please start the backend server with: npm run dev\n');
});

req.on('timeout', () => {
    console.log(`⏱️  Request timed out - server may be starting up\n`);
    req.destroy();
});

req.end();
