// Quick test script to call the chatbot API and see error logs
const courseId = "f26180b2-5dda-495a-a014-ae02e63f172f";
const cohortId = "b15a7011-fabf-4739-aa9b-cea57ed90648";
const question = "List top 3 learners by completion in Cohort 1";

console.log("Testing chatbot API...\n");
console.log(`Course ID: ${courseId}`);
console.log(`Cohort ID: ${cohortId}`);
console.log(`Question: ${question}\n`);

// Note: This will fail because we don't have auth token
// But it will trigger the backend code and show us the error logs
fetch("http://localhost:4000/api/tutors/assistant/query", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        courseId,
        cohortId,
        question,
    }),
})
    .then(res => res.json())
    .then(data => console.log("Response:", data))
    .catch(err => console.error("Error:", err));
