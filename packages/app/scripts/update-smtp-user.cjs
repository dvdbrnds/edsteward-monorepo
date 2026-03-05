const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function update() {
  const client = await pool.connect();
  
  try {
    // Update SMTP user
    await client.query(`
      UPDATE email_configs 
      SET smtp_user = 'edsteward@moravian.edu',
          smtp_pass = 'nyvshwvmacuxbcti'
    `);
    console.log('✅ SMTP user updated to edsteward@moravian.edu');
    
    // Get config and test
    const configResult = await client.query('SELECT * FROM email_configs LIMIT 1');
    const config = configResult.rows[0];
    
    console.log('\nConfig:');
    console.log('  From:', config.from_email);
    console.log('  User:', config.smtp_user);
    console.log('  Host:', config.smtp_host);
    console.log('  Port:', config.smtp_port);
    
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
    
    console.log('\nSending test email...');
    const info = await transporter.sendMail({
      from: config.from_email,
      to: 'brandesd@moravian.edu',
      subject: 'EdSteward Email Test - ' + new Date().toLocaleTimeString(),
      html: '<h2>✅ Email Configuration Working!</h2><p>EdSteward notifications are now configured correctly.</p>',
      text: 'Email Configuration Working!',
    });
    
    console.log('✅ Email sent successfully!');
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
