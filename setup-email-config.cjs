/**
 * Quick Email Configuration Setup
 * 
 * Run this script to configure email sending for testing attestations.
 * 
 * Usage:
 *   node setup-email-config.cjs
 * 
 * You'll be prompted for:
 *   - Your email address (Gmail recommended)
 *   - App password (for Gmail: https://myaccount.google.com/apppasswords)
 */

const { Pool } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupEmailConfig() {
  console.log('\n📧 EdSteward Email Configuration Setup\n');
  console.log('This will configure SMTP settings for sending attestation emails.\n');
  
  // Get user input
  const email = await prompt('Enter your email address (e.g., you@gmail.com): ');
  const password = await prompt('Enter your app password (16 chars for Gmail): ');
  
  // Auto-detect SMTP settings based on email domain
  let smtpHost = 'smtp.gmail.com';
  let smtpPort = 587;
  let smtpSecure = false;
  
  if (email.includes('@outlook.com') || email.includes('@hotmail.com')) {
    smtpHost = 'smtp-mail.outlook.com';
    smtpPort = 587;
  } else if (email.includes('@yahoo.com')) {
    smtpHost = 'smtp.mail.yahoo.com';
    smtpPort = 587;
  } else if (email.includes('@icloud.com')) {
    smtpHost = 'smtp.mail.me.com';
    smtpPort = 587;
  }
  
  console.log(`\n📋 Detected settings:`);
  console.log(`   SMTP Host: ${smtpHost}`);
  console.log(`   SMTP Port: ${smtpPort}`);
  console.log(`   From Email: ${email}`);
  
  const confirm = await prompt('\nProceed with these settings? (y/n): ');
  
  if (confirm.toLowerCase() !== 'y') {
    console.log('Aborted.');
    rl.close();
    return;
  }
  
  // Connect to database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'
  });
  
  try {
    // Check if email_configs table exists
    console.log('\n🔧 Checking database...');
    
    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_configs (
        id SERIAL PRIMARY KEY,
        from_email TEXT NOT NULL,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL,
        smtp_secure BOOLEAN NOT NULL DEFAULT false,
        smtp_user TEXT NOT NULL,
        smtp_pass TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by INTEGER NOT NULL DEFAULT 1
      )
    `);
    
    // Check if config exists
    const existing = await pool.query('SELECT id FROM email_configs LIMIT 1');
    
    if (existing.rows.length > 0) {
      // Update existing config
      await pool.query(`
        UPDATE email_configs 
        SET from_email = $1, smtp_host = $2, smtp_port = $3, 
            smtp_secure = $4, smtp_user = $5, smtp_pass = $6, 
            updated_at = NOW()
        WHERE id = $7
      `, [email, smtpHost, smtpPort, smtpSecure, email, password, existing.rows[0].id]);
      console.log('✅ Updated existing email configuration');
    } else {
      // Insert new config
      await pool.query(`
        INSERT INTO email_configs (from_email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, 1)
      `, [email, smtpHost, smtpPort, smtpSecure, email, password]);
      console.log('✅ Created new email configuration');
    }
    
    console.log('\n🎉 Email configuration complete!');
    console.log('\n📝 Test it by:');
    console.log('   1. Go to http://localhost:3000/admin/settings');
    console.log('   2. Scroll to "Test Email Configuration"');
    console.log('   3. Enter your email and click "Send Test Email"');
    console.log('\n   Or use the Send Attestation button on any regulation page!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
    rl.close();
  }
}

setupEmailConfig();

