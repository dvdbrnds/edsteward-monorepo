const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function update() {
  const client = await pool.connect();
  
  try {
    // Update password without spaces
    await client.query(`
      UPDATE email_configs 
      SET smtp_pass = 'nyvshwvmacuxbcti'
    `);
    console.log('✅ Password updated (no spaces)');
    
    // Get config and test
    const configResult = await client.query('SELECT * FROM email_configs LIMIT 1');
    const config = configResult.rows[0];
    
    console.log('Testing with user:', config.smtp_user);
    
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
    });
    
    await transporter.verify();
    console.log('✅ SMTP connection verified!');
    
    const info = await transporter.sendMail({
      from: config.from_email,
      to: 'brandesd@moravian.edu',
      subject: 'EdSteward Test - ' + new Date().toLocaleTimeString(),
      html: '<h2>✅ It works!</h2>',
      text: 'It works!',
    });
    
    console.log('✅ Email sent! Message ID:', info.messageId);
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

update();
