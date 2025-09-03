#!/usr/bin/env node

/**
 * CSV to Database Migration Script
 * Migrates regulation data from compmat.csv to PostgreSQL database
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import database connection
import { query, transaction } from '../src/database/connection.js';

/**
 * Generate regulation slug from statute name
 */
function generateRegulationSlug(statuteName) {
  if (!statuteName) return 'unknown-regulation';
  
  return statuteName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Determine topic category from topic name
 */
function getTopicCategory(topicName) {
  if (!topicName) return 'general';
  
  const topic = topicName.toLowerCase();
  
  if (topic.includes('civil rights') || topic.includes('discrimination') || 
      topic.includes('diversity') || topic.includes('affirmative action')) {
    return 'civil-rights';
  }
  if (topic.includes('academic') || topic.includes('education') || 
      topic.includes('student') || topic.includes('research')) {
    return 'education';
  }
  if (topic.includes('accounting') || topic.includes('financial') || 
      topic.includes('contracts') || topic.includes('procurement')) {
    return 'financial';
  }
  if (topic.includes('health') || topic.includes('medical') || 
      topic.includes('insurance')) {
    return 'healthcare';
  }
  if (topic.includes('human resources') || topic.includes('employment')) {
    return 'employment';
  }
  if (topic.includes('privacy') || topic.includes('information') || 
      topic.includes('security')) {
    return 'privacy';
  }
  if (topic.includes('safety') || topic.includes('environmental')) {
    return 'environmental';
  }
  
  return 'general';
}

/**
 * Determine enforcement agency from topic and regulation name
 */
function getEnforcementAgencyCode(topicName, regulationName) {
  const topic = (topicName || '').toLowerCase();
  const name = (regulationName || '').toLowerCase();
  
  // Civil rights regulations
  if (name.includes('title ix') || name.includes('title vii') || 
      name.includes('title vi') || name.includes('discrimination') ||
      name.includes('civil rights') || name.includes('ada') || 
      name.includes('disabilities') || name.includes('fair housing')) {
    if (name.includes('fair housing') || name.includes('housing')) {
      return 'HUD';
    }
    if (name.includes('employment') || name.includes('workplace')) {
      return 'EEOC';
    }
    return 'OCR';
  }
  
  // Financial regulations
  if (topic.includes('accounting') || topic.includes('financial') ||
      name.includes('sox') || name.includes('sarbanes') || 
      name.includes('securities')) {
    if (name.includes('sox') || name.includes('sarbanes') || 
        name.includes('securities')) {
      return 'SEC';
    }
    return 'TREASURY';
  }
  
  // Healthcare regulations
  if (topic.includes('health') || name.includes('hipaa') || 
      name.includes('health')) {
    return 'HHS';
  }
  
  // Education regulations
  if (topic.includes('education') || topic.includes('academic') ||
      topic.includes('student')) {
    return 'ED';
  }
  
  // Employment regulations
  if (topic.includes('employment') || topic.includes('human resources') ||
      name.includes('employment') || name.includes('labor')) {
    return 'DOL';
  }
  
  // Copyright regulations
  if (name.includes('copyright') || name.includes('teach act') || 
      name.includes('dmca')) {
    return 'COPYRIGHT';
  }
  
  // Environmental regulations
  if (topic.includes('environmental') || topic.includes('safety') ||
      name.includes('environmental')) {
    return 'EPA';
  }
  
  return 'ED'; // Default to Department of Education
}

/**
 * Generate compliance focus from topic and regulation
 */
function getComplianceFocus(topicName, regulationName) {
  const topic = (topicName || '').toLowerCase();
  const name = (regulationName || '').toLowerCase();
  
  if (topic.includes('civil rights') || topic.includes('discrimination') ||
      name.includes('discrimination') || name.includes('civil rights')) {
    return 'Non-Discrimination & Equal Access';
  }
  if (topic.includes('financial') || topic.includes('accounting')) {
    return 'Financial Reporting & Audit Compliance';
  }
  if (topic.includes('health') || name.includes('hipaa')) {
    return 'Healthcare Privacy & Security';
  }
  if (topic.includes('education') || topic.includes('academic')) {
    return 'Educational Program Compliance';
  }
  if (topic.includes('employment') || topic.includes('human resources')) {
    return 'Employment & Workplace Compliance';
  }
  if (topic.includes('privacy') || topic.includes('information')) {
    return 'Data Privacy & Information Security';
  }
  if (topic.includes('environmental') || topic.includes('safety')) {
    return 'Environmental & Safety Compliance';
  }
  if (name.includes('copyright') || name.includes('teach act')) {
    return 'Copyright & Fair Use';
  }
  
  return 'General Regulatory Compliance';
}

/**
 * Main migration function
 */
async function migrateCSVToDatabase() {
  console.log('🚀 Starting CSV to Database Migration...');
  
  try {
    // Read CSV file
    const csvPath = path.resolve(process.cwd(), 'compmat.csv');
    console.log(`📖 Reading CSV file: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`📊 Found ${records.length} records in CSV`);
    
    // Run migration in transaction
    await transaction(async (client) => {
      console.log('🔄 Starting database transaction...');
      
      // Set tenant context
      await client.query("SET app.tenant_id = 'default'");
      
      let processedCount = 0;
      let skippedCount = 0;
      
      for (const record of records) {
        try {
          // Skip records without statute name
          if (!record['Statute Name'] || record['Statute Name'].trim() === '') {
            skippedCount++;
            continue;
          }
          
          // Get or create topic
          const topicName = record['Topic'] || 'General Compliance';
          const topicCategory = getTopicCategory(topicName);
          
          const topicResult = await client.query(`
            INSERT INTO topics (tenant_id, topic_name, topic_category, description)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tenant_id, topic_name) DO UPDATE SET
              topic_category = EXCLUDED.topic_category,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
          `, ['default', topicName, topicCategory, `${topicCategory} compliance requirements`]);
          
          const topicId = topicResult.rows[0].id;
          
          // Get or create enforcement agency
          const agencyCode = getEnforcementAgencyCode(topicName, record['Statute Name']);
          const agencyResult = await client.query(`
            SELECT id FROM enforcement_agencies 
            WHERE tenant_id = $1 AND agency_code = $2
          `, ['default', agencyCode]);
          
          const agencyId = agencyResult.rows[0]?.id;
          
          // Generate regulation data
          const regulationSlug = generateRegulationSlug(record['Statute Name']);
          const complianceFocus = getComplianceFocus(topicName, record['Statute Name']);
          
          // Insert or update regulation
          await client.query(`
            INSERT INTO regulations (
              tenant_id, regulation_id, name, description, item_id,
              topic_id, statute_name, statute_1, statute_2, statute_3, statute_4,
              statute_ids, regulation_1, regulation_2, regulation_3, regulation_4, regulation_5,
              statutory_summary, reporting_requirements, deadlines,
              additional_resources_1, additional_resources_2, sortable_month,
              topic_id_original, last_updated_original, enforcement_agency_id,
              compliance_focus, regulation_slug, is_active
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
              $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
            )
            ON CONFLICT (tenant_id, regulation_id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              item_id = EXCLUDED.item_id,
              topic_id = EXCLUDED.topic_id,
              statute_name = EXCLUDED.statute_name,
              statute_1 = EXCLUDED.statute_1,
              statute_2 = EXCLUDED.statute_2,
              statute_3 = EXCLUDED.statute_3,
              statute_4 = EXCLUDED.statute_4,
              statute_ids = EXCLUDED.statute_ids,
              regulation_1 = EXCLUDED.regulation_1,
              regulation_2 = EXCLUDED.regulation_2,
              regulation_3 = EXCLUDED.regulation_3,
              regulation_4 = EXCLUDED.regulation_4,
              regulation_5 = EXCLUDED.regulation_5,
              statutory_summary = EXCLUDED.statutory_summary,
              reporting_requirements = EXCLUDED.reporting_requirements,
              deadlines = EXCLUDED.deadlines,
              additional_resources_1 = EXCLUDED.additional_resources_1,
              additional_resources_2 = EXCLUDED.additional_resources_2,
              sortable_month = EXCLUDED.sortable_month,
              topic_id_original = EXCLUDED.topic_id_original,
              last_updated_original = EXCLUDED.last_updated_original,
              enforcement_agency_id = EXCLUDED.enforcement_agency_id,
              compliance_focus = EXCLUDED.compliance_focus,
              regulation_slug = EXCLUDED.regulation_slug,
              updated_at = CURRENT_TIMESTAMP
          `, [
            'default', // tenant_id
            regulationSlug, // regulation_id (using slug as ID)
            record['Statute Name'] || 'Unknown Regulation', // name
            record['Statutory Summary'] || 'No description available', // description
            parseInt(record['Item ID']) || null, // item_id
            topicId, // topic_id
            record['Statute Name'] || '', // statute_name
            record['Statute 1'] || '', // statute_1
            record['Statute 2'] || '', // statute_2
            record['Statute 3'] || '', // statute_3
            record['Statute 4'] || '', // statute_4
            record['Statute IDs'] || '', // statute_ids
            record['Regulation 1'] || '', // regulation_1
            record['Regulation 2'] || '', // regulation_2
            record['Regulation 3'] || '', // regulation_3
            record['Regulation 4'] || '', // regulation_4
            record['Regulation 5'] || '', // regulation_5
            record['Statutory Summary'] || '', // statutory_summary
            record['Reporting Requirements'] || '', // reporting_requirements
            record['Deadlines'] || '', // deadlines
            record['Additional Resources 1'] || '', // additional_resources_1
            record['Additional Resources 2'] || '', // additional_resources_2
            record['Sortable Month'] || '', // sortable_month
            parseInt(record['Topic ID']) || null, // topic_id_original
            record['Last Updated'] || '', // last_updated_original
            agencyId, // enforcement_agency_id
            complianceFocus, // compliance_focus
            regulationSlug, // regulation_slug
            true // is_active
          ]);
          
          processedCount++;
          
          if (processedCount % 50 === 0) {
            console.log(`📈 Processed ${processedCount} regulations...`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing record ${record['Item ID']}: ${error.message}`);
          skippedCount++;
        }
      }
      
      console.log(`✅ Migration completed successfully!`);
      console.log(`📊 Processed: ${processedCount} regulations`);
      console.log(`⏭️  Skipped: ${skippedCount} records`);
      
      // Verify migration
      const countResult = await client.query(`
        SELECT COUNT(*) as total_regulations,
               COUNT(DISTINCT topic_id) as total_topics,
               COUNT(DISTINCT enforcement_agency_id) as total_agencies
        FROM regulations 
        WHERE tenant_id = 'default' AND is_active = true
      `);
      
      const stats = countResult.rows[0];
      console.log(`🎯 Database now contains:`);
      console.log(`   - ${stats.total_regulations} active regulations`);
      console.log(`   - ${stats.total_topics} topics`);
      console.log(`   - ${stats.total_agencies} enforcement agencies`);
      
    }, 'default');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCSVToDatabase()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { migrateCSVToDatabase };


