const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function testEmail() {
  const client = await pool.connect();
  
  try {
    // Get email config
    const result = await client.query('SELECT * FROM email_configs LIMIT 1');
    if (result.rows.length === 0) {
      console.log('❌ No email config found');
      return;
    }
    
    const config = result.rows[0];
    console.log('Email Config:');
    console.log('  From:', config.from_email);
    console.log('  SMTP Host:', config.smtp_host);
    console.log('  SMTP Port:', config.smtp_port);
    console.log('  SMTP User:', config.smtp_user);
    console.log('  SMTP Secure:', config.smtp_secure);
    console.log('  Password:', config.smtp_pass ? '***SET***' : '❌ NOT SET');
    
    // Create transporter
    console.log('\nCreating transporter...');
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
    });
    
    // Verify connection
    console.log('Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('✅ SMTP connection verified');
    } catch (verifyErr) {
      console.log('❌ SMTP verification failed:', verifyErr.message);
      return;
    }
    
    // Try sending
    console.log('\nSending test email to brandesd@moravian.edu...');
    try {
      const info = await transporter.sendMail({
        from: config.from_email,
        to: 'brandesd@moravian.edu',
        subject: 'EdSteward Direct Test - ' + new Date().toLocaleTimeString(),
        html: '<h2>Direct SMTP Test</h2><p>If you see this, email is working!</p>',
        text: 'Direct SMTP Test - If you see this, email is working!',
      });
      
      console.log('✅ Email sent!');
      console.log('  Message ID:', info.messageId);
      console.log('  Response:', info.response);
    } catch (sendErr) {
      console.log('❌ Send failed:', sendErr.message);
      console.log('  Full error:', sendErr);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

testEmail();
