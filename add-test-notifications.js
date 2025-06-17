#!/usr/bin/env node
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { notifications } from "./shared/schema.ts";
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function addTestNotifications() {
  console.log("Adding test notifications...");
  
  const testNotifications = [
    { regulationId: 1, userId: 1, type: 'email', frequency: 'daily', enabled: true },
    { regulationId: 2, userId: 1, type: 'sms', frequency: 'weekly', enabled: true },
    { regulationId: 3, userId: 2, type: 'email', frequency: 'monthly', enabled: true },
    { regulationId: 4, userId: 2, type: 'sms', frequency: 'daily', enabled: false },
    { regulationId: 5, userId: 3, type: 'email', frequency: 'weekly', enabled: true },
    { regulationId: 6, userId: 3, type: 'sms', frequency: 'monthly', enabled: true },
    { regulationId: 7, userId: 4, type: 'email', frequency: 'daily', enabled: true },
    { regulationId: 8, userId: 4, type: 'sms', frequency: 'weekly', enabled: false },
    { regulationId: 9, userId: 5, type: 'email', frequency: 'monthly', enabled: true },
    { regulationId: 10, userId: 5, type: 'sms', frequency: 'daily', enabled: true },
    { regulationId: 11, userId: 6, type: 'email', frequency: 'weekly', enabled: true }, // dvdbrnds
    { regulationId: 12, userId: 6, type: 'sms', frequency: 'monthly', enabled: true },  // dvdbrnds
  ];

  try {
    // First, let's see what's currently in the table
    const existing = await db.select().from(notifications);
    console.log(`Found ${existing.length} existing notifications`);
    
    // Add the test notifications
    for (const notification of testNotifications) {
      const [result] = await db.insert(notifications).values(notification).returning();
      console.log(`Added notification ${result.id}: ${result.type} for user ${result.userId}`);
    }
    
    console.log("Test notifications added successfully!");
    
    // Show total count now
    const updated = await db.select().from(notifications);
    console.log(`Total notifications now: ${updated.length}`);
    
  } catch (error) {
    console.error("Error adding test notifications:", error);
  } finally {
    await sql.end();
  }
}

addTestNotifications(); 