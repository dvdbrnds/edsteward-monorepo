const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function update() {
  const client = await pool.connect();
  try {
    // Update from_email
    const result = await client.query(`
      UPDATE email_configs 
      SET from_email = 'edsteward@moravian.edu'
      RETURNING from_email, smtp_host, smtp_user
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Email config updated:');
      console.log('   From Email: ' + result.rows[0].from_email);
      console.log('   SMTP Host:  ' + result.rows[0].smtp_host);
      console.log('   SMTP User:  ' + result.rows[0].smtp_user);
      console.log('');
      console.log('Note: SMTP user is still the old address - you may need to');
      console.log('update SMTP credentials if using a different mailbox.');
    } else {
      console.log('No email config found to update');
    }
  } finally {
    client.release();
    await pool.end();
  }
}
update();
