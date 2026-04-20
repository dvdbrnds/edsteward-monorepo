/**
 * Data Subject Rights API (HECVAT PRIV-03)
 * Provides self-service data export for individual users
 * Allows users to download all their personal data per GDPR/FERPA requirements
 */

import express, { Request, Response } from 'express';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { getDatabaseStorage } from '../../services/database';

const router = express.Router();

// Require authentication for all routes
function requireAuth(req: Request, res: Response, next: express.NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * GET /api/my-data
 * Export all data associated with the current user
 * Returns JSON with all user-related records
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  if (!user || !user.id) {
    return res.status(401).json({ error: 'User not found in session' });
  }

  const tenantStorage = getDatabaseStorage((req as any).tenantId);
  const pool = (tenantStorage as any).pool;
  const exportId = `USER-EXPORT-${Date.now()}-${user.id}`;

  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Data subject export requested by user ${user.id} (${user.email})`);

    // 1. User profile data
    const userResult = await pool.query(`
      SELECT id, username, email, "firstName", "lastName", role, department,
             "identityProvider", "isActive", "mfaEnabled", "createdAt", "updatedAt"
      FROM users WHERE id = $1
    `, [user.id]);

    // 2. Tasks assigned to user
    const tasksResult = await pool.query(`
      SELECT id, title, description, status, priority, due_date, created_at, updated_at
      FROM compliance_tasks WHERE assigned_to = $1
      ORDER BY created_at DESC
    `, [user.id]);

    // 3. Task activity by user
    const activityResult = await pool.query(`
      SELECT ta.id, ta.task_id, ta.activity_type, ta.content, ta.created_at,
             ct.title as task_title
      FROM task_activity ta
      LEFT JOIN compliance_tasks ct ON ta.task_id = ct.id
      WHERE ta.user_id = $1
      ORDER BY ta.created_at DESC
    `, [user.id]);

    // 4. Evidence uploaded by user
    const evidenceResult = await pool.query(`
      SELECT te.id, te.task_id, te.file_name, te.file_type, te.file_size, te.uploaded_at,
             ct.title as task_title
      FROM task_evidence te
      LEFT JOIN compliance_tasks ct ON te.task_id = ct.id
      WHERE te.uploaded_by = $1
      ORDER BY te.uploaded_at DESC
    `, [user.id]);

    // 5. Notes by user
    const notesResult = await pool.query(`
      SELECT n.id, n.regulation_id, n.content, n.created_at,
             r.name as regulation_name
      FROM notes n
      LEFT JOIN regulations r ON n.regulation_id = r.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
    `, [user.id]);

    // 6. Attestation records involving user
    const attestationsResult = await pool.query(`
      SELECT tat.id, tat.task_id, tat.created_at, tat.expires_at, tat.used_at,
             ct.title as task_title
      FROM task_attestation_tokens tat
      LEFT JOIN compliance_tasks ct ON tat.task_id = ct.id
      WHERE tat.created_by = $1
      ORDER BY tat.created_at DESC
    `, [user.id]);

    // 7. Audit logs for user actions
    const auditResult = await pool.query(`
      SELECT id, action, entity_type, entity_id, timestamp, metadata
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT 1000
    `, [user.id]);

    // 8. Auth/login logs for user
    const authLogsResult = await pool.query(`
      SELECT id, timestamp, severity, message, structured_data
      FROM system_logs
      WHERE message LIKE $1 OR message LIKE $2
      ORDER BY timestamp DESC
      LIMIT 100
    `, [`%${user.email}%`, `%${user.username}%`]);


    const exportData = {
      exportMetadata: {
        exportId,
        exportedAt: new Date().toISOString(),
        userId: user.id,
        email: user.email,
        purpose: 'Data Subject Access Request (DSAR)',
        dataCategories: [
          'Profile information',
          'Assigned compliance tasks',
          'Activity history',
          'Uploaded evidence',
          'Notes and comments',
          'Attestation records',
          'Audit trail',
          'Authentication logs'
        ]
      },
      profile: userResult.rows[0] || null,
      assignedTasks: tasksResult.rows,
      activityHistory: activityResult.rows,
      uploadedEvidence: evidenceResult.rows.map(e => ({
        ...e,
        // Don't include actual file content, just metadata
        downloadNote: 'File contents available separately upon request'
      })),
      notes: notesResult.rows,
      attestations: attestationsResult.rows.map(a => ({
        ...a,
        token: '[REDACTED]' // Don't expose tokens
      })),
      auditTrail: auditResult.rows,
      authenticationLogs: authLogsResult.rows.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        event: log.message,
        // Strip IP and user-agent for privacy in export
      })),
      summary: {
        totalTasks: tasksResult.rows.length,
        totalActivities: activityResult.rows.length,
        totalEvidence: evidenceResult.rows.length,
        totalNotes: notesResult.rows.length,
        totalAttestations: attestationsResult.rows.length,
        totalAuditEntries: auditResult.rows.length,
        totalAuthLogs: authLogsResult.rows.length,
      }
    };

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Data subject export completed for user ${user.id}: ${JSON.stringify(exportData.summary)}`);

    // Set download headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="my-data-export-${exportId}.json"`);
    res.json(exportData);

  } catch (error) {
    // pool is shared tenant pool — do not close
    
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      `Data subject export failed for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`);

    res.status(500).json({
      error: 'Failed to generate data export',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/my-data/summary
 * Get a summary of what data is held about the current user (without full export)
 */
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  if (!user || !user.id) {
    return res.status(401).json({ error: 'User not found in session' });
  }

  const tenantStorage2 = getDatabaseStorage((req as any).tenantId);
  const pool = (tenantStorage2 as any).pool;

  try {
    const [tasks, activities, evidence, notes, attestations, audits] = await Promise.all([
      pool.query('SELECT count(*) FROM compliance_tasks WHERE assigned_to = $1', [user.id]),
      pool.query('SELECT count(*) FROM task_activity WHERE user_id = $1', [user.id]),
      pool.query('SELECT count(*) FROM task_evidence WHERE uploaded_by = $1', [user.id]),
      pool.query('SELECT count(*) FROM notes WHERE user_id = $1', [user.id]),
      pool.query('SELECT count(*) FROM task_attestation_tokens WHERE created_by = $1', [user.id]),
      pool.query('SELECT count(*) FROM audit_logs WHERE user_id = $1', [user.id]),
    ]);


    res.json({
      userId: user.id,
      email: user.email,
      dataHeld: {
        profileInformation: true,
        assignedTasks: Number(tasks.rows[0]?.count || 0),
        activityRecords: Number(activities.rows[0]?.count || 0),
        uploadedEvidence: Number(evidence.rows[0]?.count || 0),
        notes: Number(notes.rows[0]?.count || 0),
        attestations: Number(attestations.rows[0]?.count || 0),
        auditLogEntries: Number(audits.rows[0]?.count || 0),
      },
      rights: {
        export: 'Available via "Download My Data" button',
        deletion: 'Contact your administrator to request account deletion',
        correction: 'Profile information can be updated in account settings',
      }
    });
  } catch (error) {
    // pool is shared tenant pool — do not close
    res.status(500).json({ error: 'Failed to retrieve data summary' });
  }
});

export default router;
