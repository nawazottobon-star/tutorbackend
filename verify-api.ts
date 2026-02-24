import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/tutors';
const CREDS = {
    email: 'jaswanthvanapalli12@gmail.com',
    password: 'Ottobon@2025'
};
const COURSE_ID = 'f26180b2-5dda-495a-a014-ae02e63f172f';
const COHORT_ID = '224a0abd-e092-4534-9daf-da5b6173f311'; // Cohort 2

async function main() {
    try {
        console.log('1. Logging in...');
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(CREDS)
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
        }

        const loginData = await loginRes.json();
        const token = loginData.session.accessToken;
        console.log('Login successful. Token obtained.');

        console.log(`2. Fetching progress for Cohort 2 (${COHORT_ID})...`);
        const progressRes = await fetch(`${BASE_URL}/${COURSE_ID}/progress?cohortId=${COHORT_ID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!progressRes.ok) {
            throw new Error(`Progress fetch failed: ${progressRes.status} ${await progressRes.text()}`);
        }

        const progressData = await progressRes.json();
        console.log('Progress Data Received:');
        console.log(`Total Learners: ${(progressData.learners || []).length}`);
        console.log('Learners:', JSON.stringify(progressData.learners, null, 2));

    } catch (err) {
        console.error('VERIFICATION FAILED:', err);
    }
}

main();
