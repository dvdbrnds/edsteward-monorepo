/**
 * Data Retention API Routes
 * Provides endpoints for managing and monitoring data retention
 * 
 * HECVAT Compliance: Implements data retention and disposal policy
 */

import { Router, Request, Response } from 'express';
import { DataRetentionService, RETENTION_PERIODS } from '../../services/data-retention';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';

const router = Router();

// Require admin role for all data retention endpoints
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * GET /api/admin/data-retention/status
 * Get current data retention status and statistics
 */
router.get('/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await DataRetentionService.getRetentionStatusReport();
    
    res.json({
      success: true,
      retentionPolicies: {
        systemLogs: `${RETENTION_PERIODS.SYSTEM_LOGS} days`,
        auditLogs: `${RETENTION_PERIODS.AUDIT_LOGS} days (7 years)`,
        attestationTokens: `${RETENTION_PERIODS.ATTESTATION_TOKENS} days after expiry`,
        softDeleteGrace: `${RETENTION_PERIODS.SOFT_DELETE_GRACE} days`,
      },
      currentStatus: report,
      complianceNote: 'Audit logs are retained for 7 years per HECVAT requirements',
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Data retention status error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve retention status' 
    });
  }
});

/**
 * POST /api/admin/data-retention/run
 * Manually trigger data retention jobs
 */
router.post('/run', requireAdmin, async (req: Request, res: Response) => {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Manual data retention job triggered by user ${req.user?.id}`);
    
    const summary = await DataRetentionService.runAllRetentionJobs();
    
    // Log the execution for audit trail
    syslog.logAuditEvent(LogLevel.INFO, 
      'Data retention jobs executed manually', 
      {
        userId: req.user?.id,
        userEmail: req.user?.email,
        totalRecordsDeleted: summary.totalRecordsDeleted,
        hasErrors: summary.hasErrors,
      }
    );
    
    res.json({
      success: !summary.hasErrors,
      summary,
      message: summary.hasErrors 
        ? 'Data retention completed with errors' 
        : 'Data retention completed successfully',
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Data retention execution error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to execute data retention jobs' 
    });
  }
});

/**
 * GET /api/admin/data-retention/policies
 * Get documented retention policies for compliance reporting
 */
router.get('/policies', requireAdmin, async (req: Request, res: Response) => {
  res.json({
    success: true,
    policies: [
      {
        dataType: 'Session Data',
        retentionPeriod: '24 hours after expiry',
        disposalMethod: 'Automatic purge',
        complianceRequirement: 'Security best practice',
      },
      {
        dataType: 'System/Application Logs',
        retentionPeriod: '90 days',
        disposalMethod: 'Automatic purge',
        complianceRequirement: 'HECVAT operational logging',
      },
      {
        dataType: 'Audit Logs',
        retentionPeriod: '7 years (2557 days)',
        disposalMethod: 'Archived, then secure deletion',
        complianceRequirement: 'HECVAT audit trail requirement',
      },
      {
        dataType: 'Customer Account Data',
        retentionPeriod: 'Active account + 30 days',
        disposalMethod: 'Soft delete, then permanent deletion after grace period',
        complianceRequirement: 'FERPA, GDPR right to erasure',
      },
      {
        dataType: 'Compliance Data (Regulations, Tasks)',
        retentionPeriod: 'Customer-controlled + 7 years',
        disposalMethod: 'Customer-initiated export/deletion',
        complianceRequirement: 'Customer contractual requirements',
      },
      {
        dataType: 'Evidence Files',
        retentionPeriod: 'Customer-controlled + 7 years',
        disposalMethod: 'Secure file deletion with overwrite',
        complianceRequirement: 'Compliance documentation retention',
      },
      {
        dataType: 'Database Backups',
        retentionPeriod: '30 days (rolling)',
        disposalMethod: 'Automatic rotation',
        complianceRequirement: 'Disaster recovery',
      },
    ],
    lastUpdated: '2026-02-05',
    policyDocument: '/docs/compliance/DATA_RETENTION_POLICY.md',
  });
});

export default router;
