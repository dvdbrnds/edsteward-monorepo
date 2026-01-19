const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function fix() {
  const client = await pool.connect();
  
  try {
    // Fix: Port 587 uses STARTTLS (secure: false)
    const result = await client.query(`
      UPDATE email_configs 
      SET smtp_secure = false
      WHERE smtp_port = 587
      RETURNING from_email, smtp_host, smtp_port, smtp_secure, smtp_user
    `);
    
    if (result.rows.length > 0) {
      const config = result.rows[0];
      console.log('✅ Fixed SMTP config:');
      console.log('  From:', config.from_email);
      console.log('  Host:', config.smtp_host);
      console.log('  Port:', config.smtp_port);
      console.log('  Secure:', config.smtp_secure, '(STARTTLS)');
    }
    
    // Now get full config and test
    const configResult = await client.query('SELECT * FROM email_configs LIMIT 1');
    const config = configResult.rows[0];
    
    console.log('\nTesting connection...');
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
    console.log('\nSending test email...');
    const info = await transporter.sendMail({
      from: config.from_email,
      to: 'brandesd@moravian.edu',
      subject: 'EdSteward Test - ' + new Date().toLocaleTimeString(),
      html: '<h2>✅ Email Working!</h2><p>SMTP configuration is now correct.</p>',
      text: 'Email Working! SMTP configuration is now correct.',
    });
    
    console.log('✅ Test email sent!');
    console.log('  Message ID:', info.messageId);
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();
