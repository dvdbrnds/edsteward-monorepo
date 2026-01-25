#!/usr/bin/env node
/**
 * Generate Deadlines from Regulations' Filing Deadlines
 * 
 * This script reads regulations with filing_deadlines and creates
 * deadline entries for tracking in the Upcoming Deadlines widget.
 * 
 * Usage: node scripts/generate-deadlines-from-regulations.cjs [--dry-run]
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const isDryRun = process.argv.includes('--dry-run');

/**
 * Calculate the next occurrence of a recurring deadline
 */
function calculateNextDeadlineDate(filingDeadline, referenceDate = new Date()) {
  const { recurringMonth, recurringDay, frequency, date } = filingDeadline;
  
  // If there's a specific date, use it
  if (date) {
    const deadlineDate = new Date(date);
    if (deadlineDate > referenceDate) {
      return deadlineDate;
    }
    // If the date has passed and it's not recurring, skip it
    if (frequency !== 'annual' && frequency !== 'quarterly' && frequency !== 'monthly') {
      return null;
    }
  }
  
  // Handle annual recurring deadlines
  if (frequency === 'annual' && recurringMonth && recurringDay) {
    const currentYear = referenceDate.getFullYear();
    
    // Try current year first
    let nextDeadline = new Date(currentYear, recurringMonth - 1, recurringDay);
    
    // If it's already passed this year, use next year
    if (nextDeadline <= referenceDate) {
      nextDeadline = new Date(currentYear + 1, recurringMonth - 1, recurringDay);
    }
    
    return nextDeadline;
  }
  
  // Handle quarterly deadlines
  if (frequency === 'quarterly') {
    const currentMonth = referenceDate.getMonth();
    const currentYear = referenceDate.getFullYear();
    
    // Quarter end months: March (2), June (5), September (8), December (11)
    const quarterEndMonths = [2, 5, 8, 11];
    
    for (const month of quarterEndMonths) {
      const deadlineDate = new Date(currentYear, month, recurringDay || 15);
      if (deadlineDate > referenceDate) {
        return deadlineDate;
      }
    }
    
    // Next year Q1
    return new Date(currentYear + 1, 2, recurringDay || 15);
  }
  
  // Handle monthly deadlines
  if (frequency === 'monthly') {
    const currentMonth = referenceDate.getMonth();
    const currentYear = referenceDate.getFullYear();
    const day = recurringDay || 15;
    
    let nextDeadline = new Date(currentYear, currentMonth, day);
    if (nextDeadline <= referenceDate) {
      nextDeadline = new Date(currentYear, currentMonth + 1, day);
    }
    
    return nextDeadline;
  }
  
  // Handle "as-needed" or "ongoing" - these don't have specific dates
  if (frequency === 'as-needed' || frequency === 'ongoing') {
    return null; // Skip these, they're not date-based
  }
  
  // Handle legacy format (deadline field with string like "annual - specific date varies")
  if (filingDeadline.deadline) {
    const deadlineStr = filingDeadline.deadline.toLowerCase();
    
    if (deadlineStr.includes('annual')) {
      // Default to end of year if no specific date
      const currentYear = referenceDate.getFullYear();
      let nextDeadline = new Date(currentYear, 11, 31); // Dec 31
      
      if (nextDeadline <= referenceDate) {
        nextDeadline = new Date(currentYear + 1, 11, 31);
      }
      
      return nextDeadline;
    }
    
    // Skip ongoing/event-triggered
    if (deadlineStr.includes('ongoing') || deadlineStr.includes('event-triggered')) {
      return null;
    }
  }
  
  return null;
}

/**
 * Format date for PostgreSQL
 */
function formatDateForPostgres(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Generate a description for the deadline
 */
function generateDeadlineDescription(filingDeadline, regulationName) {
  const parts = [];
  
  if (filingDeadline.type) {
    parts.push(filingDeadline.type);
  }
  
  if (filingDeadline.description && filingDeadline.description !== filingDeadline.type) {
    parts.push(filingDeadline.description);
  }
  
  if (filingDeadline.reportingTo) {
    parts.push(`Report to: ${filingDeadline.reportingTo}`);
  }
  
  if (filingDeadline.penaltyForMissing) {
    parts.push(`Penalty: ${filingDeadline.penaltyForMissing}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : `Compliance deadline for ${regulationName}`;
}

async function generateDeadlines() {
  const client = await pool.connect();
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Generating Deadlines from Regulations');
    console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Get all regulations with filing_deadlines
    const regulationsResult = await client.query(`
      SELECT id, name, filing_deadlines
      FROM regulations 
      WHERE filing_deadlines IS NOT NULL 
        AND filing_deadlines::text != 'null'
        AND filing_deadlines::text != '[]'
    `);
    
    console.log(`Found ${regulationsResult.rows.length} regulations with filing deadlines\n`);
    
    // Get existing deadlines to avoid duplicates
    const existingDeadlinesResult = await client.query(`
      SELECT regulation_id, due_date, description FROM deadlines
    `);
    
    const existingDeadlines = new Set(
      existingDeadlinesResult.rows.map(d => 
        `${d.regulation_id}-${d.due_date}-${d.description?.substring(0, 50)}`
      )
    );
    
    console.log(`Found ${existingDeadlinesResult.rows.length} existing deadlines\n`);
    
    // Get a default user to assign deadlines to (first admin or first user)
    const defaultUserResult = await client.query(`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `);
    
    let defaultAssignee = 1;
    if (defaultUserResult.rows.length > 0) {
      defaultAssignee = defaultUserResult.rows[0].id;
    }
    
    console.log(`Default assignee user ID: ${defaultAssignee}\n`);
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    const referenceDate = new Date();
    
    for (const regulation of regulationsResult.rows) {
      const filingDeadlines = regulation.filing_deadlines;
      
      if (!Array.isArray(filingDeadlines)) {
        continue;
      }
      
      for (const fd of filingDeadlines) {
        try {
          const nextDate = calculateNextDeadlineDate(fd, referenceDate);
          
          if (!nextDate) {
            skipped++;
            continue;
          }
          
          const description = generateDeadlineDescription(fd, regulation.name);
          const dueDateStr = formatDateForPostgres(nextDate);
          
          // Check for duplicate
          const key = `${regulation.id}-${dueDateStr}-${description.substring(0, 50)}`;
          if (existingDeadlines.has(key)) {
            console.log(`  SKIP (exists): ${regulation.name} - ${fd.type || fd.description || 'Deadline'}`);
            skipped++;
            continue;
          }
          
          // Use default assignee for now (can be updated later when attestation workflow is assigned)
          let assignee = defaultAssignee;
          
          console.log(`  CREATE: ${regulation.name}`);
          console.log(`          Type: ${fd.type || fd.description || 'Compliance Deadline'}`);
          console.log(`          Due: ${dueDateStr}`);
          console.log(`          Assigned to: User ${assignee}`);
          
          if (!isDryRun) {
            await client.query(`
              INSERT INTO deadlines (regulation_id, due_date, status, assigned_to, description, is_default)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              regulation.id,
              dueDateStr,
              'pending',
              assignee,
              description,
              true // Mark as auto-generated
            ]);
          }
          
          created++;
          existingDeadlines.add(key); // Prevent duplicates within same run
          
        } catch (err) {
          console.error(`  ERROR processing deadline for ${regulation.name}: ${err.message}`);
          errors++;
        }
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('Summary:');
    console.log(`  Created: ${created}`);
    console.log(`  Skipped: ${skipped} (no date or already exists)`);
    console.log(`  Errors: ${errors}`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (isDryRun) {
      console.log('This was a DRY RUN. Run without --dry-run to create deadlines.\n');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

generateDeadlines().catch(console.error);
