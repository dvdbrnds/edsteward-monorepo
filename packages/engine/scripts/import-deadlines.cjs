/**
 * MCP Engine: Deadline Import Script
 * 
 * Creates compliance deadlines based on regulation categories and requirements.
 * Enhanced JSON files contain deadline info in text fields - we extract key patterns.
 * 
 * Run with: node scripts/import-deadlines.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER,
  password: process.env.MCP_DB_PASSWORD || '',
});

// Standard deadline patterns by category
const categoryDeadlines = {
  'Financial Aid': [
    { name: 'FISAP Annual Report', frequency: 'annual', recurring_month: 10, recurring_day: 1, deadline_type: 'filing', reporting_to: 'Department of Education' },
    { name: 'Annual Financial Aid Audit', frequency: 'annual', recurring_month: 6, recurring_day: 30, deadline_type: 'audit', reporting_to: 'External Auditor' },
    { name: 'Gainful Employment Disclosure Update', frequency: 'annual', recurring_month: 7, recurring_day: 1, deadline_type: 'disclosure', reporting_to: 'Department of Education' },
  ],
  'Environmental Health and Safety': [
    { name: 'OSHA 300 Log Posting', frequency: 'annual', recurring_month: 2, recurring_day: 1, deadline_type: 'posting', reporting_to: 'OSHA', penalty_for_missing: 'Fines up to $15,625 per violation' },
    { name: 'Annual Safety Training', frequency: 'annual', recurring_month: 1, recurring_day: 31, deadline_type: 'training', reporting_to: 'Internal Records' },
    { name: 'Hazardous Waste Manifest Submission', frequency: 'as-needed', deadline_type: 'filing', reporting_to: 'EPA', penalty_for_missing: 'Criminal penalties and fines' },
  ],
  'Tax': [
    { name: 'Form 990 Filing', frequency: 'annual', recurring_month: 5, recurring_day: 15, deadline_type: 'filing', reporting_to: 'IRS', penalty_for_missing: '$20/day, up to $10,500' },
    { name: 'Form 990-T Filing (if applicable)', frequency: 'annual', recurring_month: 5, recurring_day: 15, deadline_type: 'filing', reporting_to: 'IRS' },
    { name: 'Form 1099 Filing', frequency: 'annual', recurring_month: 1, recurring_day: 31, deadline_type: 'filing', reporting_to: 'IRS' },
    { name: 'W-2 Distribution', frequency: 'annual', recurring_month: 1, recurring_day: 31, deadline_type: 'distribution', reporting_to: 'Employees' },
  ],
  'Privacy & Information Security': [
    { name: 'Annual Privacy Assessment', frequency: 'annual', recurring_month: 12, recurring_day: 31, deadline_type: 'assessment', reporting_to: 'Internal Compliance' },
    { name: 'Data Breach Notification (if applicable)', frequency: 'as-needed', advance_notice_days: 0, deadline_type: 'notification', reporting_to: 'Affected Individuals/State AG', penalty_for_missing: 'Fines per affected individual' },
    { name: 'Security Awareness Training', frequency: 'annual', recurring_month: 12, recurring_day: 31, deadline_type: 'training', reporting_to: 'Internal Records' },
  ],
  'Campus Safety': [
    { name: 'Annual Security Report (Clery)', frequency: 'annual', recurring_month: 10, recurring_day: 1, deadline_type: 'report', reporting_to: 'Department of Education', penalty_for_missing: 'Fines up to $67,544 per violation' },
    { name: 'Emergency Response Plan Review', frequency: 'annual', recurring_month: 8, recurring_day: 1, deadline_type: 'review', reporting_to: 'Internal Records' },
    { name: 'Fire Safety Report', frequency: 'annual', recurring_month: 10, recurring_day: 1, deadline_type: 'report', reporting_to: 'Department of Education' },
    { name: 'Campus Security Authority Training', frequency: 'annual', recurring_month: 9, recurring_day: 1, deadline_type: 'training', reporting_to: 'Internal Records' },
  ],
  'Research': [
    { name: 'IRB Protocol Annual Review', frequency: 'annual', deadline_type: 'review', reporting_to: 'IRB' },
    { name: 'Conflict of Interest Disclosure', frequency: 'annual', recurring_month: 1, recurring_day: 31, deadline_type: 'disclosure', reporting_to: 'Research Compliance Office' },
    { name: 'Export Control Assessment', frequency: 'annual', deadline_type: 'assessment', reporting_to: 'Export Control Officer' },
  ],
  'Accounting': [
    { name: 'Annual Financial Audit', frequency: 'annual', recurring_month: 12, recurring_day: 31, deadline_type: 'audit', reporting_to: 'External Auditor/Board' },
    { name: 'A-133 Single Audit (if applicable)', frequency: 'annual', recurring_month: 3, recurring_day: 31, deadline_type: 'audit', reporting_to: 'Federal Clearinghouse' },
    { name: 'Quarterly Financial Review', frequency: 'quarterly', deadline_type: 'review', reporting_to: 'Board Finance Committee' },
  ],
  'Grants Management': [
    { name: 'Federal Grant Financial Reports', frequency: 'quarterly', deadline_type: 'report', reporting_to: 'Funding Agency' },
    { name: 'Annual Progress Report', frequency: 'annual', deadline_type: 'report', reporting_to: 'Funding Agency' },
    { name: 'Closeout Report', frequency: 'one-time', deadline_type: 'report', reporting_to: 'Funding Agency', advance_notice_days: 90 },
  ],
  'Sexual Misconduct': [
    { name: 'Title IX Annual Report', frequency: 'annual', recurring_month: 10, recurring_day: 1, deadline_type: 'report', reporting_to: 'Department of Education' },
    { name: 'Title IX Coordinator Training', frequency: 'annual', deadline_type: 'training', reporting_to: 'Internal Records' },
    { name: 'Climate Survey', frequency: 'biennial', deadline_type: 'survey', reporting_to: 'Internal Records' },
  ],
  'Diversity/Affirmative Action': [
    { name: 'EEO-1 Report', frequency: 'annual', recurring_month: 3, recurring_day: 31, deadline_type: 'filing', reporting_to: 'EEOC' },
    { name: 'Affirmative Action Plan Update', frequency: 'annual', recurring_month: 1, recurring_day: 31, deadline_type: 'plan', reporting_to: 'OFCCP' },
    { name: 'VETS-4212 Report', frequency: 'annual', recurring_month: 9, recurring_day: 30, deadline_type: 'filing', reporting_to: 'Department of Labor' },
  ],
  'Employee Benefits': [
    { name: 'Form 5500 Filing', frequency: 'annual', recurring_month: 7, recurring_day: 31, deadline_type: 'filing', reporting_to: 'DOL/IRS' },
    { name: 'Summary Annual Report Distribution', frequency: 'annual', deadline_type: 'distribution', reporting_to: 'Employees' },
    { name: 'COBRA Notice (as needed)', frequency: 'as-needed', advance_notice_days: 14, deadline_type: 'notice', reporting_to: 'Affected Employees' },
  ],
  'Information Technology': [
    { name: 'Annual IT Security Assessment', frequency: 'annual', deadline_type: 'assessment', reporting_to: 'CIO/CISO' },
    { name: 'Vulnerability Scan', frequency: 'quarterly', deadline_type: 'scan', reporting_to: 'IT Security' },
    { name: 'Disaster Recovery Plan Test', frequency: 'annual', deadline_type: 'test', reporting_to: 'CIO' },
  ],
  'Copyright & Trademark': [
    { name: 'Annual DMCA Agent Registration Renewal', frequency: 'annual', deadline_type: 'registration', reporting_to: 'Copyright Office' },
    { name: 'Copyright Policy Review', frequency: 'annual', deadline_type: 'review', reporting_to: 'General Counsel' },
  ],
  'Lobbying and Political Activities': [
    { name: 'LD-2 Lobbying Report', frequency: 'quarterly', deadline_type: 'report', reporting_to: 'Congress', penalty_for_missing: 'Criminal penalties up to $200,000' },
    { name: 'Political Activity Compliance Review', frequency: 'annual', deadline_type: 'review', reporting_to: 'General Counsel' },
  ],
  'Ethics': [
    { name: 'Annual Ethics Training', frequency: 'annual', deadline_type: 'training', reporting_to: 'Internal Records' },
    { name: 'Conflict of Interest Disclosure Review', frequency: 'annual', recurring_month: 1, recurring_day: 31, deadline_type: 'review', reporting_to: 'Ethics Committee' },
  ],
  'Accreditation': [
    { name: 'Accreditation Self-Study Preparation', frequency: 'periodic', deadline_type: 'preparation', reporting_to: 'Accreditor', advance_notice_days: 365 },
    { name: 'Substantive Change Notification', frequency: 'as-needed', advance_notice_days: 90, deadline_type: 'notification', reporting_to: 'Accreditor' },
  ],
  'Contracts & Procurement': [
    { name: 'Vendor Compliance Review', frequency: 'annual', deadline_type: 'review', reporting_to: 'Procurement Office' },
    { name: 'SAM.gov Registration Renewal', frequency: 'annual', deadline_type: 'registration', reporting_to: 'SAM.gov' },
  ],
  'Export Controls': [
    { name: 'Deemed Export Assessment', frequency: 'annual', deadline_type: 'assessment', reporting_to: 'Export Control Officer' },
    { name: 'Export License Application (if applicable)', frequency: 'as-needed', deadline_type: 'application', reporting_to: 'BIS/DDTC' },
  ],
  'Recruitment Hiring & Termination': [
    { name: 'I-9 Form Audit', frequency: 'annual', deadline_type: 'audit', reporting_to: 'HR/Internal Compliance' },
    { name: 'Background Check Policy Review', frequency: 'annual', deadline_type: 'review', reporting_to: 'HR' },
  ],
  'Wages': [
    { name: 'Minimum Wage Compliance Review', frequency: 'annual', deadline_type: 'review', reporting_to: 'HR' },
    { name: 'Pay Equity Analysis', frequency: 'annual', deadline_type: 'analysis', reporting_to: 'HR/General Counsel' },
  ],
};

// Default deadline for categories without specific patterns
const defaultDeadline = { name: 'Annual Compliance Review', frequency: 'annual', recurring_month: 12, recurring_day: 31, deadline_type: 'review', reporting_to: 'Internal Compliance' };

async function importDeadlines() {
  console.log('═'.repeat(60));
  console.log('    MCP ENGINE: Deadline Import');
  console.log('═'.repeat(60));
  console.log('');
  
  // Get all regulations with their categories
  const regulations = await pool.query(`
    SELECT id, item_id, name, category 
    FROM regulations 
    ORDER BY category, name
  `);
  
  console.log(`Found ${regulations.rows.length} regulations\n`);
  
  let totalDeadlines = 0;
  let regulationsProcessed = 0;
  const deadlinesPerCategory = {};
  
  for (const reg of regulations.rows) {
    // Normalize category (handle combined categories like "Immigration,Recruitment Hiring & Termination")
    const primaryCategory = reg.category.split(',')[0].trim();
    
    // Get deadlines for this category
    let deadlines = categoryDeadlines[primaryCategory] || [defaultDeadline];
    
    // Track by category
    if (!deadlinesPerCategory[primaryCategory]) {
      deadlinesPerCategory[primaryCategory] = 0;
    }
    
    for (const deadline of deadlines) {
      // Generate unique deadline_id
      const deadlineId = `${reg.item_id}-${deadline.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      await pool.query(`
        INSERT INTO regulation_deadlines (
          regulation_id, deadline_id, name, description, deadline_type,
          frequency, recurring_month, recurring_day, advance_notice_days,
          penalty_for_missing, reporting_to
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING
      `, [
        reg.id,
        deadlineId,
        deadline.name,
        `${deadline.name} for ${reg.name}`,
        deadline.deadline_type || 'review',
        deadline.frequency || 'annual',
        deadline.recurring_month || null,
        deadline.recurring_day || null,
        deadline.advance_notice_days || 30,
        deadline.penalty_for_missing || null,
        deadline.reporting_to || 'Internal Compliance'
      ]);
      
      totalDeadlines++;
      deadlinesPerCategory[primaryCategory]++;
    }
    
    regulationsProcessed++;
  }
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log('Deadlines created by category:');
  Object.entries(deadlinesPerCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Regulations processed: ${regulationsProcessed}`);
  console.log(`Total deadlines created: ${totalDeadlines}`);
  
  // Verify
  const count = await pool.query('SELECT COUNT(*) FROM regulation_deadlines');
  console.log(`\n📊 Database now has ${count.rows[0].count} deadlines`);
  
  await pool.end();
}

importDeadlines().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
