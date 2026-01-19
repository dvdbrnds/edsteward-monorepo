/**
 * EDSTEWARD: Clean Slate & Ongoing MCP Alignment
 * 
 * This script removes pre-alignment regulations (without L.O.V.V. validation)
 * and keeps only the 251 MCP-validated regulations.
 * 
 * Handles all foreign key dependencies properly.
 */

const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' 
});

async function main() {
  const client = await pool.connect();
  
  console.log('\n' + '🔷'.repeat(30));
  console.log('EDSTEWARD CLEANUP AND ALIGNMENT');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('🔷'.repeat(30));

  try {
    // ========================================
    // STEP 1: Verify Backups Exist
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('STEP 1: Verify Backups Exist');
    console.log('='.repeat(60));
    
    const backupCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM regulations_pre_cleanup_backup) as regulations_backup,
        (SELECT COUNT(*) FROM compliance_tasks_pre_cleanup_backup) as tasks_backup,
        (SELECT COUNT(*) FROM regulation_topics_pre_cleanup_backup) as topics_backup
    `);
    
    const stats = backupCheck.rows[0];
    console.log(`   ✅ Regulations backup: ${stats.regulations_backup} rows`);
    console.log(`   ✅ Tasks backup: ${stats.tasks_backup} rows`);
    console.log(`   ✅ Topics backup: ${stats.topics_backup} rows`);

    // ========================================
    // STEP 2: Identify What to Keep vs Remove
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('STEP 2: Identify What to Keep vs Remove');
    console.log('='.repeat(60));
    
    const identify = await client.query(`
      SELECT 
        CASE WHEN lovv_level IS NOT NULL THEN 'MCP Validated (KEEP)' ELSE 'Pre-Alignment (REMOVE)' END as source,
        COUNT(*) as count
      FROM regulations
      GROUP BY CASE WHEN lovv_level IS NOT NULL THEN 'MCP Validated (KEEP)' ELSE 'Pre-Alignment (REMOVE)' END
      ORDER BY source
    `);
    
    identify.rows.forEach(row => {
      const icon = row.source.includes('KEEP') ? '✅' : '🗑️';
      console.log(`   ${icon} ${row.source}: ${row.count}`);
    });

    // ========================================
    // STEP 3: Remove Pre-Alignment Data
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('STEP 3: Remove Pre-Alignment Data (with FK handling)');
    console.log('='.repeat(60));
    
    // Start transaction
    await client.query('BEGIN');
    
    try {
      // Get IDs of regulations to remove
      const toRemove = await client.query(`
        SELECT id FROM regulations WHERE lovv_level IS NULL
      `);
      const regIdsToRemove = toRemove.rows.map(r => r.id);
      console.log(`   Found ${regIdsToRemove.length} regulations to remove`);
      
      if (regIdsToRemove.length === 0) {
        console.log('   ✅ No pre-alignment regulations to remove');
        await client.query('COMMIT');
      } else {
        // Get task IDs for those regulations
        const tasksToRemove = await client.query(`
          SELECT id FROM compliance_tasks 
          WHERE regulation_id = ANY($1::int[])
        `, [regIdsToRemove]);
        const taskIdsToRemove = tasksToRemove.rows.map(r => r.id);
        console.log(`   Found ${taskIdsToRemove.length} tasks to remove`);
        
        // DELETE ORDER (respecting FK constraints):
        // 1. task_activity (references compliance_tasks)
        // 2. task_evidence (references compliance_tasks)
        // 3. compliance_tasks (references regulations)
        // 4. attestation_tokens (references regulations)
        // 5. audit_logs (references regulations)
        // 6. notification_queue (references regulations)
        // 7. regulation_topics (references regulations)
        // 8. regulation_updates (references regulations)
        // 9. regulation_versions (references regulations)
        // 10. sync_control (references regulations)
        // 11. validation_status (references regulations)
        // 12. version_conflicts (references regulations)
        // 13. regulations
        
        if (taskIdsToRemove.length > 0) {
          // 1. Delete task_activity
          const taskActivity = await client.query(`
            DELETE FROM task_activity WHERE task_id = ANY($1::int[]) RETURNING id
          `, [taskIdsToRemove]);
          console.log(`   Deleted ${taskActivity.rowCount} task_activity records`);
          
          // 2. Delete task_evidence
          const taskEvidence = await client.query(`
            DELETE FROM task_evidence WHERE task_id = ANY($1::int[]) RETURNING id
          `, [taskIdsToRemove]);
          console.log(`   Deleted ${taskEvidence.rowCount} task_evidence records`);
        }
        
        // 3. Delete compliance_tasks
        const tasks = await client.query(`
          DELETE FROM compliance_tasks WHERE regulation_id = ANY($1::int[]) RETURNING id
        `, [regIdsToRemove]);
        console.log(`   Deleted ${tasks.rowCount} compliance_tasks`);
        
        // 4. Delete attestation_tokens
        const attestations = await client.query(`
          DELETE FROM attestation_tokens WHERE regulation_id = ANY($1::int[]) RETURNING id
        `, [regIdsToRemove]);
        console.log(`   Deleted ${attestations.rowCount} attestation_tokens`);
        
        // 5. Delete audit_logs (may have nullable FK)
        try {
          const auditLogs = await client.query(`
            DELETE FROM audit_logs WHERE regulation_id = ANY($1::int[]) RETURNING id
          `, [regIdsToRemove]);
          console.log(`   Deleted ${auditLogs.rowCount} audit_logs`);
        } catch (e) {
          console.log(`   Skipped audit_logs (${e.message})`);
        }
        
        // 6. Delete notification_queue
        try {
          const notifQueue = await client.query(`
            DELETE FROM notification_queue WHERE regulation_id = ANY($1::int[]) RETURNING id
          `, [regIdsToRemove]);
          console.log(`   Deleted ${notifQueue.rowCount} notification_queue`);
        } catch (e) {
          console.log(`   Skipped notification_queue (${e.message})`);
        }
        
        // 7. Delete regulation_topics
        const topics = await client.query(`
          DELETE FROM regulation_topics WHERE regulation_id = ANY($1::int[]) RETURNING id
        `, [regIdsToRemove]);
        console.log(`   Deleted ${topics.rowCount} regulation_topics`);
        
        // 8. Delete regulation_updates
        try {
          const updates = await client.query(`
            DELETE FROM regulation_updates WHERE regulation_id = ANY($1::int[]) RETURNING id
          `, [regIdsToRemove]);
          console.log(`   Deleted ${updates.rowCount} regulation_updates`);
        } catch (e) {
          console.log(`   Skipped regulation_updates (${e.message})`);
        }
        
        // 9. Delete regulation_versions
        try {
          const versions = await client.query(`
            DELETE FROM regulation_versions WHERE regulation_id = ANY($1::int[]) RETURNING id
          `, [regIdsToRemove]);
          console.log(`   Deleted ${versions.rowCount} regulation_versions`);
        } catch (e) {
          console.log(`   Skipped regulation_versions (${e.message})`);
        }
        
        // 10. Delete sync_control
        try {
          const syncControl = await client.query(`
            DELETE FROM sync_control WHERE regulation_id = ANY($1::int[]) RETURNING id
          `, [regIdsToRemove]);
          console.log(`   Deleted ${syncControl.rowCount} sync_control`);
        } catch (e) {
          console.log(`   Skipped sync_control (${e.message})`);
        }
        
        // 11. Delete validation_status
        try {
          const validationStatus = await client.query(`
            DELETE FROM validation_status WHERE regulation_id = ANY($1::int[]) RETURNING id
          `, [regIdsToRemove]);
          console.log(`   Deleted ${validationStatus.rowCount} validation_status`);
        } catch (e) {
          console.log(`   Skipped validation_status (${e.message})`);
        }
        
        // 12. Delete version_conflicts
        try {
          const conflicts = await client.query(`
            DELETE FROM version_conflicts WHERE regulation_id = ANY($1::int[]) RETURNING id
          `, [regIdsToRemove]);
          console.log(`   Deleted ${conflicts.rowCount} version_conflicts`);
        } catch (e) {
          console.log(`   Skipped version_conflicts (${e.message})`);
        }
        
        // Handle self-referencing FK (previous_version_id)
        await client.query(`
          UPDATE regulations SET previous_version_id = NULL 
          WHERE previous_version_id = ANY($1::int[])
        `, [regIdsToRemove]);
        
        // 13. Finally delete the regulations
        const regs = await client.query(`
          DELETE FROM regulations WHERE lovv_level IS NULL RETURNING id
        `);
        console.log(`   Deleted ${regs.rowCount} regulations`);
        
        // Verify
        const verify = await client.query(`
          SELECT 
            (SELECT COUNT(*) FROM regulations) as regulations,
            (SELECT COUNT(*) FROM compliance_tasks) as tasks,
            (SELECT COUNT(*) FROM regulation_topics) as topics
        `);
        
        const v = verify.rows[0];
        console.log(`\n   After deletion:`);
        console.log(`   - Regulations: ${v.regulations}`);
        console.log(`   - Tasks: ${v.tasks}`);
        console.log(`   - Topics: ${v.topics}`);
        
        await client.query('COMMIT');
        console.log('\n   ✅ Transaction committed');
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.log('\n   ❌ Transaction rolled back');
      throw err;
    }

    // ========================================
    // STEP 4: Verify Clean State
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('STEP 4: Verify Clean State');
    console.log('='.repeat(60));
    
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_regulations,
        COUNT(CASE WHEN jurisdiction_source = 'federal' THEN 1 END) as federal,
        COUNT(CASE WHEN state_code = 'PA' THEN 1 END) as pa,
        COUNT(CASE WHEN state_code = 'NJ' THEN 1 END) as nj,
        COUNT(CASE WHEN lovv_level IS NOT NULL THEN 1 END) as with_lovv,
        COUNT(CASE WHEN statute IS NOT NULL AND statute != '' THEN 1 END) as with_statute
      FROM regulations
    `);
    
    const s = result.rows[0];
    console.log(`   Total Regulations: ${s.total_regulations}`);
    console.log(`   Federal: ${s.federal}`);
    console.log(`   PA: ${s.pa}`);
    console.log(`   NJ: ${s.nj}`);
    console.log(`   With L.O.V.V.: ${s.with_lovv}`);
    console.log(`   With Statute: ${s.with_statute}`);
    
    // L.O.V.V. distribution
    const lovv = await client.query(`
      SELECT lovv_level, COUNT(*) as count
      FROM regulations 
      WHERE lovv_level IS NOT NULL
      GROUP BY lovv_level 
      ORDER BY lovv_level
    `);
    
    console.log('\n   L.O.V.V. Distribution:');
    lovv.rows.forEach(row => {
      console.log(`     Level ${row.lovv_level}: ${row.count}`);
    });
    
    // Related data
    const related = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM regulation_topics) as topic_mappings,
        (SELECT COUNT(*) FROM compliance_tasks) as tasks
    `);
    
    const r = related.rows[0];
    console.log(`\n   Topic Mappings: ${r.topic_mappings}`);
    console.log(`   Compliance Tasks: ${r.tasks}`);

    // ========================================
    // STEP 5: Create Alignment Verification View
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('STEP 5: Create Alignment Verification View');
    console.log('='.repeat(60));
    
    await client.query(`
      CREATE OR REPLACE VIEW alignment_status AS
      SELECT 
        (SELECT COUNT(*) FROM regulations) as total_regulations,
        (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NOT NULL) as mcp_validated,
        (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NULL) as unvalidated,
        (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'federal') as federal,
        (SELECT COUNT(*) FROM regulations WHERE state_code = 'PA') as pennsylvania,
        (SELECT COUNT(*) FROM regulations WHERE state_code = 'NJ') as new_jersey,
        (SELECT COUNT(*) FROM regulation_topics) as topic_mappings,
        (SELECT COUNT(*) FROM compliance_tasks) as compliance_tasks,
        (SELECT MAX(last_updated) FROM regulations) as last_updated
    `);
    
    // Query the view
    const viewResult = await client.query('SELECT * FROM alignment_status');
    console.log('   ✅ View created. Current status:');
    Object.entries(viewResult.rows[0]).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`);
    });

    console.log('\n' + '🎉'.repeat(30));
    console.log('CLEANUP AND ALIGNMENT COMPLETE!');
    console.log('🎉'.repeat(30));
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
