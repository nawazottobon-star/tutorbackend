async function testLogin() {
    try {
        const response = await fetch('http://localhost:4000/api/tutors/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: "vanapallijaswanth12@gmail.com", password: "YourNewPassword123" })
        });
        const text = await response.text();
        console.log(`HTTP ${response.status}: ${text}`);
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}
testLogin();
