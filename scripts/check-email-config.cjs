const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function check() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM email_configs LIMIT 1');
    if (result.rows.length > 0) {
      const config = result.rows[0];
      console.log('Current email config:');
      console.log('  From Email:', config.from_email);
      console.log('  SMTP Host:', config.smtp_host);
      console.log('  SMTP User:', config.smtp_user);
    } else {
      console.log('No email config found');
    }
  } finally {
    client.release();
    await pool.end();
  }
}
check();
