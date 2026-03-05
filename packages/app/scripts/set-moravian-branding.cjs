#!/usr/bin/env node
/**
 * Script to set Moravian University branding in the database
 * Run with: node scripts/set-moravian-branding.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');

async function setMoravianBranding() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const moravianBranding = {
    institutionName: "Moravian University",
    title: "Moravian University Compliance Portal",
    logoUrl: "/assets/Moravian-Monogram-MoravianBlue.png",
    faviconUrl: "/favicon.ico",
    primaryColor: "#003366",  // Moravian blue
    secondaryColor: "#1e40af",
    accentColor: "#3b82f6",
    loginScreenBackgroundColor: "#f8fafc",
    loginScreenAccentColor: "#003366",
    loginScreenTextColor: "#1f2937",
    loginScreenHeroColor: "#002244",
    tenantId: "moravian"
  };

  try {
    console.log('🎓 Setting Moravian University branding...\n');

    // Check if branding_configurations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branding_configurations (
        id SERIAL PRIMARY KEY,
        config_data JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Check current branding
    const current = await pool.query('SELECT config_data FROM branding_configurations WHERE id = 1');
    if (current.rows.length > 0) {
      console.log('📋 Current branding:', JSON.stringify(current.rows[0].config_data, null, 2));
    }

    // Update or insert Moravian branding
    const result = await pool.query(`
      INSERT INTO branding_configurations (id, config_data, created_at, updated_at)
      VALUES (1, $1, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        config_data = $1,
        updated_at = NOW()
      RETURNING config_data
    `, [JSON.stringify(moravianBranding)]);

    console.log('\n✅ Moravian branding set successfully!');
    console.log('\n📋 New branding configuration:');
    console.log(JSON.stringify(result.rows[0].config_data, null, 2));
    
    console.log('\n🔄 Restart your dev server to see the changes.');
  } catch (error) {
    console.error('❌ Error setting branding:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setMoravianBranding();
