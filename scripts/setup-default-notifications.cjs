#!/usr/bin/env node

/**
 * Setup Default Notification Settings
 * Creates default notification preferences for users
 */

const { Client } = require('pg');

async function setupDefaultNotifications() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Check current notifications
    const currentNotifications = await client.query('SELECT * FROM notifications ORDER BY id');
    console.log(`📊 Current notifications: ${currentNotifications.rows.length}`);
    
    if (currentNotifications.rows.length > 0) {
      console.log('Current notification settings:');
      currentNotifications.rows.forEach(row => {
        console.log(`  - User ${row.user_id}: ${row.type} ${row.frequency} (${row.enabled ? 'enabled' : 'disabled'})`);
      });
    }

    // Get all users
    const users = await client.query('SELECT id, username, email FROM users ORDER BY id');
    console.log(`👥 Found ${users.rows.length} users`);

    // Set up default notifications for each user
    for (const user of users.rows) {
      console.log(`\n🔧 Setting up notifications for user: ${user.username} (ID: ${user.id})`);
      
      // Check if user already has notifications
      const existingNotifications = await client.query(
        'SELECT * FROM notifications WHERE user_id = $1',
        [user.id]
      );

      if (existingNotifications.rows.length === 0) {
        // Create default email notification (weekly, enabled)
        await client.query(`
          INSERT INTO notifications (regulation_id, user_id, type, frequency, enabled)
          VALUES (1, $1, 'email', 'weekly', true)
        `, [user.id]);
        
        console.log(`  ✅ Created default email notification (weekly, enabled)`);
      } else {
        console.log(`  ℹ️  User already has ${existingNotifications.rows.length} notification(s)`);
        
        // Update existing notifications to have proper defaults
        for (const notification of existingNotifications.rows) {
          if (!notification.frequency || notification.frequency === '') {
            await client.query(
              'UPDATE notifications SET frequency = $1 WHERE id = $2',
              ['weekly', notification.id]
            );
            console.log(`  🔄 Updated notification ${notification.id} frequency to 'weekly'`);
          }
          
          if (notification.enabled === null || notification.enabled === undefined) {
            await client.query(
              'UPDATE notifications SET enabled = $1 WHERE id = $2',
              [true, notification.id]
            );
            console.log(`  🔄 Updated notification ${notification.id} enabled to 'true'`);
          }
        }
      }
    }

    // Show final state
    const finalNotifications = await client.query('SELECT * FROM notifications ORDER BY user_id, id');
    console.log(`\n📊 Final notification count: ${finalNotifications.rows.length}`);
    console.log('\nFinal notification settings:');
    finalNotifications.rows.forEach(row => {
      console.log(`  - User ${row.user_id}: ${row.type} ${row.frequency} (${row.enabled ? 'enabled' : 'disabled'})`);
    });

  } catch (error) {
    console.error('❌ Error setting up notifications:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Set DATABASE_URL if not provided
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
}

setupDefaultNotifications().catch(console.error);
