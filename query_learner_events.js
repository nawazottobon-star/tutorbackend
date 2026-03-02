const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.your-tenant-id:ETISXXlWzudeqcbs3VIe6KRMiQkBPBPfG8fddoTWp1c@72.61.227.244:6543/postgres?sslmode=disable&pgbouncer=true'
});

async function main() {
  const client = await pool.connect();

  // Get column info
  const colRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'learner_activity_events'
    ORDER BY ordinal_position;
  `);

  console.log('=== TABLE: learner_activity_events ===');
  console.log('\n--- COLUMNS ---');
  console.table(colRes.rows);

  // Get row count
  const countRes = await client.query('SELECT COUNT(*) FROM learner_activity_events;');
  console.log('Total rows:', countRes.rows[0].count);

  // Get sample data
  const dataRes = await client.query('SELECT * FROM learner_activity_events LIMIT 20;');
  console.log('\n--- SAMPLE DATA (up to 20 rows) ---');
  console.log(JSON.stringify(dataRes.rows, null, 2));

  client.release();
  await pool.end();
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
