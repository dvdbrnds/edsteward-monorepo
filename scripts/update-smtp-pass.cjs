const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function update() {
  const client = await pool.connect();
  
  try {
    // Update password
    await client.query(`
      UPDATE email_configs 
      SET smtp_pass = 'nyvs hwvm acux bcti'
    `);
    console.log('✅ Password updated');
    
    // Get config and test
    const configResult = await client.query('SELECT * FROM email_configs LIMIT 1');
    const config = configResult.rows[0];
    
    console.log('\nTesting SMTP connection...');
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
    
    // Send test
    console.log('\nSending test email to brandesd@moravian.edu...');
    const info = await transporter.sendMail({
      from: config.from_email,
      to: 'brandesd@moravian.edu',
      subject: 'EdSteward Email Test - ' + new Date().toLocaleTimeString(),
      html: '<h2>✅ Email Configuration Working!</h2><p>Your EdSteward email notifications are now properly configured.</p><p>Sent at: ' + new Date().toLocaleString() + '</p>',
      text: 'Email Configuration Working! Your EdSteward email notifications are now properly configured.',
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('  Message ID:', info.messageId);
    console.log('\n📧 Check your inbox!');
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

update();
