const fs = require('fs');
const content = fs.readFileSync('src/services/tutorQueries.ts', 'utf8');
const lines = content.split('\n');
const functionNames = new Map();

lines.forEach((line, index) => {
    const match = line.match(/export async function (\w+)/);
    if (match) {
        const name = match[1];
        if (!functionNames.has(name)) {
            functionNames.set(name, []);
        }
        functionNames.get(name).push(index + 1);
    }
});

const duplicates = Array.from(functionNames.entries()).filter(([name, lines]) => lines.length > 1);
console.log(JSON.stringify(duplicates, null, 2));
