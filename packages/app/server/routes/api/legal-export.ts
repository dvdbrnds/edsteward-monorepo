/**
 * Legal Export API
 * Provides comprehensive data export for legal discovery/subpoena response
 * 
 * Exports ALL data related to a regulation including:
 * - Regulation details and full text
 * - All compliance tasks and their complete history
 * - All evidence files and attachments
 * - All attestation records with signatures
 * - Complete audit trail
 * - Notes and comments
 * - Deadlines and their status changes
 * - Version history
 */

import express, { Request, Response } from 'express';
import { requireAuth, requirePermission } from '../../middleware/role-based-auth';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { getDatabaseStorage } from '../../services/database';
import { AuditService } from '../../services/audit';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';

const router = express.Router();

interface LegalExportData {
  exportMetadata: {
    exportId: string;
    exportedAt: string;
    exportedBy: {
      userId: number;
      email: string;
      name: string;
    };
    purpose: string;
    regulationId: number;
    regulationName: string;
    dataIntegrityHash?: string;
  };
  regulation: any;
  complianceTasks: any[];
  taskActivity: any[];
  attestationTokens: any[];
  evidence: any[];
  notes: any[];
  deadlines: any[];
  auditLogs: any[];
  versionHistory: any[];
}

/**
 * GET /api/legal-export/regulation/:regulationId
 * Export ALL data for a single regulation for legal/subpoena purposes
 * Returns JSON with complete audit trail and all related data
 */
router.get('/regulation/:regulationId', requireAuth, requirePermission('canManageSystemSettings'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  const regulationId = parseInt(req.params.regulationId);
  const { format = 'json', purpose = 'Legal Discovery Request' } = req.query;

  if (isNaN(regulationId)) {
    return res.status(400).json({ error: 'Invalid regulation ID' });
  }

  const tenantStorage = getDatabaseStorage((req as any).tenantId);
  const pool = (tenantStorage as any).pool;

  try {
    // Generate export ID for tracking
    const exportId = `LEGAL-${Date.now()}-${regulationId}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
      `⚖️ LEGAL EXPORT INITIATED: Export ID ${exportId} for regulation ${regulationId} by user ${req.user?.id} (${req.user?.email}) - Purpose: ${purpose}`
    );

    // 1. Get regulation details
    const regulationResult = await pool.query(`
      SELECT r.*, 
             u.email as owner_email, u.username as owner_username, 
             u."firstName" as owner_first_name, u."lastName" as owner_last_name
      FROM regulations r
      LEFT JOIN users u ON r.owner_id = u.id
      WHERE r.id = $1
    `, [regulationId]);

    if (regulationResult.rows.length === 0) {
      // pool is shared tenant pool — do not close
      return res.status(404).json({ error: 'Regulation not found' });
    }

    const regulation = regulationResult.rows[0];

    // 2. Get all compliance tasks for this regulation
    const tasksResult = await pool.query(`
      SELECT ct.*, 
             u.email as assigned_user_email, u.username as assigned_username,
             u."firstName" as assigned_first_name, u."lastName" as assigned_last_name
      FROM compliance_tasks ct
      LEFT JOIN users u ON ct.assigned_to = u.id
      WHERE ct.regulation_id = $1
      ORDER BY ct.created_at ASC
    `, [regulationId]);

    // 3. Get all task activity for tasks in this regulation
    const taskIds = tasksResult.rows.map((t: any) => t.id);
    let taskActivityResult = { rows: [] as any[] };
    if (taskIds.length > 0) {
      taskActivityResult = await pool.query(`
        SELECT ta.*, 
               u.email as user_email, u.username,
               u."firstName", u."lastName",
               ct.title as task_title
        FROM task_activity ta
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN compliance_tasks ct ON ta.task_id = ct.id
        WHERE ta.task_id = ANY($1)
        ORDER BY ta.created_at ASC
      `, [taskIds]);
    }

    // 4. Get all attestation tokens for tasks in this regulation
    let attestationResult = { rows: [] as any[] };
    if (taskIds.length > 0) {
      attestationResult = await pool.query(`
        SELECT tat.*, 
               u.email as created_by_email, u.username as created_by_username,
               u."firstName" as created_by_first_name, u."lastName" as created_by_last_name,
               ct.title as task_title
        FROM task_attestation_tokens tat
        LEFT JOIN users u ON tat.created_by = u.id
        LEFT JOIN compliance_tasks ct ON tat.task_id = ct.id
        WHERE tat.task_id = ANY($1)
        ORDER BY tat.created_at ASC
      `, [taskIds]);
    }

    // 5. Get all evidence files for tasks in this regulation
    let evidenceResult = { rows: [] as any[] };
    if (taskIds.length > 0) {
      evidenceResult = await pool.query(`
        SELECT te.*, 
               u.email as uploaded_by_email, u.username as uploaded_by_username,
               u."firstName" as uploaded_by_first_name, u."lastName" as uploaded_by_last_name,
               ct.title as task_title
        FROM task_evidence te
        LEFT JOIN users u ON te.uploaded_by = u.id
        LEFT JOIN compliance_tasks ct ON te.task_id = ct.id
        WHERE te.task_id = ANY($1)
        ORDER BY te.uploaded_at ASC
      `, [taskIds]);
    }

    // 6. Get all notes for this regulation
    const notesResult = await pool.query(`
      SELECT n.*, 
             u.email as author_email, u.username as author_username,
             u."firstName" as author_first_name, u."lastName" as author_last_name
      FROM notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.regulation_id = $1
      ORDER BY n.created_at ASC
    `, [regulationId]);

    // 7. Get all deadlines for this regulation
    const deadlinesResult = await pool.query(`
      SELECT d.*, 
             u.email as assigned_user_email, u.username as assigned_username,
             u."firstName" as assigned_first_name, u."lastName" as assigned_last_name
      FROM deadlines d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.regulation_id = $1
      ORDER BY d.due_date ASC
    `, [regulationId]);

    // 8. Get audit logs from audit_logs table
    const auditResult = await AuditService.queryAuditLogs({
      regulationId,
      limit: 10000,
      offset: 0
    });

    // 9. Get regulation updates (version history)
    const versionHistoryResult = await pool.query(`
      SELECT ru.*, 
             u.email as approved_by_email, u.username as approved_by_username,
             u."firstName" as approved_by_first_name, u."lastName" as approved_by_last_name
      FROM regulation_updates ru
      LEFT JOIN users u ON ru.approved_by = u.id
      WHERE ru.regulation_id = $1
      ORDER BY ru.update_date ASC
    `, [regulationId]);

    // pool is shared tenant pool — do not close

    // Compile the export data
    const exportData: LegalExportData = {
      exportMetadata: {
        exportId,
        exportedAt: new Date().toISOString(),
        exportedBy: {
          userId: req.user!.id,
          email: req.user!.email || 'unknown',
          name: req.user?.firstName && req.user?.lastName 
            ? `${req.user.firstName} ${req.user.lastName}` 
            : req.user?.username || 'unknown'
        },
        purpose: purpose as string,
        regulationId,
        regulationName: regulation.name || regulation.topic || `Regulation ${regulationId}`,
      },
      regulation,
      complianceTasks: tasksResult.rows,
      taskActivity: taskActivityResult.rows,
      attestationTokens: attestationResult.rows.map(t => ({
        ...t,
        token: '[REDACTED FOR SECURITY]' // Don't expose actual tokens
      })),
      evidence: evidenceResult.rows,
      notes: notesResult.rows,
      deadlines: deadlinesResult.rows,
      auditLogs: auditResult.logs,
      versionHistory: versionHistoryResult.rows,
    };

    // Calculate statistics
    const stats = {
      totalTasks: tasksResult.rows.length,
      totalActivityRecords: taskActivityResult.rows.length,
      totalAttestations: attestationResult.rows.length,
      totalEvidenceFiles: evidenceResult.rows.length,
      totalNotes: notesResult.rows.length,
      totalDeadlines: deadlinesResult.rows.length,
      totalAuditLogs: auditResult.logs.length,
      totalVersions: versionHistoryResult.rows.length,
      dateRange: {
        earliest: taskActivityResult.rows[0]?.created_at || regulation.created_at,
        latest: new Date().toISOString()
      }
    };

    const exportTime = Date.now() - startTime;

    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
      `⚖️ LEGAL EXPORT COMPLETE: Export ID ${exportId} - ${stats.totalActivityRecords} activity records, ${stats.totalEvidenceFiles} evidence files - ${exportTime}ms`
    );

    // Log this export action for audit purposes
    try {
      await AuditService.logAudit({
        entityType: 'legal_export',
        entityId: exportId,
        action: 'create',
        regulationId,
        complianceImpact: 'high',
        riskLevel: 'critical',
        metadata: {
          purpose,
          stats,
          exportTime
        }
      }, AuditService.extractAuditContext(req));
    } catch (auditError) {
      // Don't fail the export if audit logging fails
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to log legal export audit: ${auditError}`);
    }

    if (format === 'json') {
      res.json({
        success: true,
        exportId,
        stats,
        data: exportData
      });
    } else {
      // For other formats, still return JSON but with appropriate headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="legal-export-${exportId}.json"`);
      res.json({
        success: true,
        exportId,
        stats,
        data: exportData
      });
    }

  } catch (error) {
    // pool is shared tenant pool — do not close
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      `⚖️ LEGAL EXPORT FAILED: Regulation ${regulationId} - ${error instanceof Error ? error.message : String(error)}`
    );

    res.status(500).json({
      error: 'Failed to generate legal export',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/legal-export/regulation/:regulationId/download
 * Download complete export as ZIP file including evidence files
 */
router.get('/regulation/:regulationId/download', requireAuth, requirePermission('canManageSystemSettings'), async (req: Request, res: Response) => {
  const regulationId = parseInt(req.params.regulationId);
  const { purpose = 'Legal Discovery Request' } = req.query;

  if (isNaN(regulationId)) {
    return res.status(400).json({ error: 'Invalid regulation ID' });
  }

  const tenantStorage = getDatabaseStorage((req as any).tenantId);
  const pool = (tenantStorage as any).pool;
  const exportId = `LEGAL-${Date.now()}-${regulationId}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
      `⚖️ LEGAL EXPORT ZIP INITIATED: Export ID ${exportId} for regulation ${regulationId} by user ${req.user?.id}`
    );

    // Get all the data (same queries as above)
    const regulationResult = await pool.query(`SELECT * FROM regulations WHERE id = $1`, [regulationId]);
    if (regulationResult.rows.length === 0) {
      // pool is shared tenant pool — do not close
      return res.status(404).json({ error: 'Regulation not found' });
    }

    const regulation = regulationResult.rows[0];

    // Get tasks
    const tasksResult = await pool.query(`
      SELECT ct.*, u.email as assigned_user_email, u."firstName", u."lastName"
      FROM compliance_tasks ct
      LEFT JOIN users u ON ct.assigned_to = u.id
      WHERE ct.regulation_id = $1
    `, [regulationId]);

    const taskIds = tasksResult.rows.map((t: any) => t.id);

    // Get task activity
    let taskActivityResult = { rows: [] as any[] };
    if (taskIds.length > 0) {
      taskActivityResult = await pool.query(`
        SELECT ta.*, u.email, u."firstName", u."lastName", ct.title as task_title
        FROM task_activity ta
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN compliance_tasks ct ON ta.task_id = ct.id
        WHERE ta.task_id = ANY($1)
        ORDER BY ta.created_at ASC
      `, [taskIds]);
    }

    // Get evidence files
    let evidenceResult = { rows: [] as any[] };
    if (taskIds.length > 0) {
      evidenceResult = await pool.query(`
        SELECT te.*, ct.title as task_title
        FROM task_evidence te
        LEFT JOIN compliance_tasks ct ON te.task_id = ct.id
        WHERE te.task_id = ANY($1)
      `, [taskIds]);
    }

    // Get notes
    const notesResult = await pool.query(`
      SELECT n.*, u.email, u."firstName", u."lastName"
      FROM notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.regulation_id = $1
    `, [regulationId]);

    // Get deadlines
    const deadlinesResult = await pool.query(`SELECT * FROM deadlines WHERE regulation_id = $1`, [regulationId]);

    // pool is shared tenant pool — do not close

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="legal-export-${exportId}.zip"`);

    archive.pipe(res);

    // Add metadata JSON
    const metadata = {
      exportId,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.email,
      purpose,
      regulationId,
      regulationName: regulation.name || regulation.topic,
      contents: [
        'metadata.json - This file',
        'regulation.json - Full regulation details',
        'tasks.json - All compliance tasks',
        'activity.json - Complete activity timeline',
        'notes.json - All notes and comments',
        'deadlines.json - All deadlines',
        'evidence/ - Folder containing all evidence files'
      ]
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    // Add data files
    archive.append(JSON.stringify(regulation, null, 2), { name: 'regulation.json' });
    archive.append(JSON.stringify(tasksResult.rows, null, 2), { name: 'tasks.json' });
    archive.append(JSON.stringify(taskActivityResult.rows, null, 2), { name: 'activity.json' });
    archive.append(JSON.stringify(notesResult.rows, null, 2), { name: 'notes.json' });
    archive.append(JSON.stringify(deadlinesResult.rows, null, 2), { name: 'deadlines.json' });

    // Add evidence files
    const uploadsDir = path.join(process.cwd(), 'uploads');
    for (const evidence of evidenceResult.rows) {
      if (evidence.file_path) {
        const filePath = path.join(uploadsDir, evidence.file_path);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: `evidence/${evidence.file_name || evidence.file_path}` });
        }
      }
    }

    // Add a summary report
    const summaryReport = `
LEGAL EXPORT SUMMARY REPORT
===========================
Export ID: ${exportId}
Generated: ${new Date().toISOString()}
Generated By: ${req.user?.email}
Purpose: ${purpose}

REGULATION
----------
ID: ${regulation.id}
Name: ${regulation.name || regulation.topic}
Category: ${regulation.category || 'N/A'}

DATA SUMMARY
------------
Compliance Tasks: ${tasksResult.rows.length}
Activity Records: ${taskActivityResult.rows.length}
Evidence Files: ${evidenceResult.rows.length}
Notes: ${notesResult.rows.length}
Deadlines: ${deadlinesResult.rows.length}

This export contains all data related to the above regulation
as of the export timestamp. All timestamps are in UTC.

---
EdSteward Compliance Management Platform
`;
    archive.append(summaryReport, { name: 'SUMMARY.txt' });

    await archive.finalize();

    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
      `⚖️ LEGAL EXPORT ZIP COMPLETE: Export ID ${exportId}`
    );

  } catch (error) {
    // pool is shared tenant pool — do not close
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      `⚖️ LEGAL EXPORT ZIP FAILED: ${error instanceof Error ? error.message : String(error)}`
    );

    res.status(500).json({
      error: 'Failed to generate legal export ZIP',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
