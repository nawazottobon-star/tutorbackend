const { Pool } = require('pg');
const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL="([^"]+)"/);
const connStr = match ? match[1] : null;
console.log('Testing URL:', connStr ? connStr.replace(/:[^:@]+@/, ':****@') : 'NOT FOUND');
if (!connStr) { console.log('ERROR: DATABASE_URL not found in .env'); process.exit(1); }
const pool = new Pool({ connectionString: connStr });
pool.query('SELECT 1 as ok')
    .then(r => { console.log('DB UP ✅ - query result:', r.rows[0]); pool.end(); })
    .catch(e => { console.log('DB FAIL ❌:', e.message, '\nCode:', e.code); pool.end(); });
