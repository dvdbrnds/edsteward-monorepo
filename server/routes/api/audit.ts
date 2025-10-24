/**
 * Audit API Routes for EdSteward
 * Provides endpoints for querying audit trail and compliance logs
 */

import express from 'express';
import { AuditService } from '../../services/audit';
import { requireAuth, requirePermission } from '../../middleware/role-based-auth';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { z } from 'zod';

const router = express.Router();

// Query parameters schema
const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.enum(['create', 'update', 'delete', 'view']).optional(),
  userId: z.coerce.number().optional(),
  regulationId: z.coerce.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  complianceImpact: z.enum(['high', 'medium', 'low']).optional(),
  riskLevel: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  limit: z.coerce.number().min(1).max(1000).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional()
});

/**
 * GET /api/audit/logs - Query audit logs with filtering
 * Requires admin or compliance officer permissions
 */
router.get('/logs', requireAuth, requirePermission('audit_view'), async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Validate query parameters
    const queryParams = auditQuerySchema.parse(req.query);
    
    // Convert date strings to Date objects
    const options = {
      ...queryParams,
      startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
      endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined
    };

    const result = await AuditService.queryAuditLogs(options);
    
    const totalTime = Date.now() - startTime;
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Audit logs queried by user ${req.user?.id} in ${totalTime}ms - returned ${result.logs.length}/${result.total} logs`
    );

    res.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        limit: options.limit,
        offset: options.offset,
        hasMore: result.total > (options.offset + options.limit)
      },
      query: options,
      meta: {
        queryTime: totalTime
      }
    });

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to query audit logs: ${error instanceof Error ? error.message : String(error)}`
    );
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to query audit logs',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/audit/entity/:entityType/:entityId - Get audit trail for specific entity
 * Requires admin or compliance officer permissions
 */
router.get('/entity/:entityType/:entityId', requireAuth, requirePermission('audit_view'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'Entity type and ID are required'
      });
    }

    const auditTrail = await AuditService.getEntityAuditTrail(entityType, entityId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Audit trail requested for ${entityType}:${entityId} by user ${req.user?.id} - ${auditTrail.length} entries`
    );

    res.json({
      success: true,
      data: auditTrail,
      entity: {
        type: entityType,
        id: entityId
      },
      meta: {
        totalEntries: auditTrail.length,
        dateRange: auditTrail.length > 0 ? {
          earliest: auditTrail[auditTrail.length - 1].timestamp,
          latest: auditTrail[0].timestamp
        } : null
      }
    });

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to get entity audit trail: ${error instanceof Error ? error.message : String(error)}`
    );

    res.status(500).json({
      success: false,
      error: 'Failed to get audit trail',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/audit/summary - Get audit summary for compliance reporting
 * Requires admin or compliance officer permissions
 */
router.get('/summary', requireAuth, requirePermission('audit_view'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const summary = await AuditService.getAuditSummary(start, end);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Audit summary requested by user ${req.user?.id} for period ${start?.toISOString()} to ${end?.toISOString()}`
    );

    res.json({
      success: true,
      data: summary,
      period: {
        startDate: start?.toISOString(),
        endDate: end?.toISOString()
      },
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.email
      }
    });

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to get audit summary: ${error instanceof Error ? error.message : String(error)}`
    );

    res.status(500).json({
      success: false,
      error: 'Failed to get audit summary',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/audit/regulation/:regulationId - Get all audit logs for a specific regulation
 * Requires admin or compliance officer permissions
 */
router.get('/regulation/:regulationId', requireAuth, requirePermission('audit_view'), async (req, res) => {
  try {
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid regulation ID'
      });
    }

    const result = await AuditService.queryAuditLogs({
      regulationId,
      limit: 1000, // Higher limit for regulation-specific queries
      offset: 0
    });

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Regulation audit logs requested for regulation ${regulationId} by user ${req.user?.id} - ${result.logs.length} entries`
    );

    res.json({
      success: true,
      data: result.logs,
      regulationId,
      meta: {
        totalEntries: result.total,
        actionSummary: result.logs.reduce((acc, log) => {
          acc[log.action] = (acc[log.action] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        entitySummary: result.logs.reduce((acc, log) => {
          acc[log.entityType] = (acc[log.entityType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to get regulation audit logs: ${error instanceof Error ? error.message : String(error)}`
    );

    res.status(500).json({
      success: false,
      error: 'Failed to get regulation audit logs',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/audit/compliance-report - Generate compliance audit report
 * Requires admin permissions
 */
router.get('/compliance-report', requireAuth, requirePermission('audit_admin'), async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get comprehensive audit data
    const [summary, highRiskActions, complianceActions] = await Promise.all([
      AuditService.getAuditSummary(start, end),
      AuditService.queryAuditLogs({
        riskLevel: 'critical',
        startDate: start,
        endDate: end,
        limit: 100
      }),
      AuditService.queryAuditLogs({
        entityType: 'regulation_action',
        startDate: start,
        endDate: end,
        limit: 500
      })
    ]);

    const report = {
      reportInfo: {
        title: 'EdSteward Compliance Audit Report',
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        },
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.email
      },
      summary,
      criticalActions: {
        total: highRiskActions.total,
        actions: highRiskActions.logs
      },
      complianceActions: {
        total: complianceActions.total,
        actions: complianceActions.logs
      },
      recommendations: generateComplianceRecommendations(summary, highRiskActions.logs)
    };

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Compliance audit report generated by user ${req.user?.id} for period ${start.toISOString()} to ${end.toISOString()}`
    );

    if (format === 'csv') {
      // TODO: Implement CSV export
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-audit-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv"`);
      res.send('CSV export not yet implemented');
    } else {
      res.json({
        success: true,
        data: report
      });
    }

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to generate compliance report: ${error instanceof Error ? error.message : String(error)}`
    );

    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Generate compliance recommendations based on audit data
 */
function generateComplianceRecommendations(summary: any, criticalActions: any[]): string[] {
  const recommendations: string[] = [];

  if (summary.highRiskActions > 10) {
    recommendations.push('High number of critical/high-risk actions detected. Consider implementing additional approval workflows.');
  }

  if (criticalActions.length > 0) {
    recommendations.push('Critical actions require immediate review and documentation.');
  }

  if (summary.actionsByType.delete > summary.actionsByType.create) {
    recommendations.push('More deletions than creations detected. Ensure proper retention policies are followed.');
  }

  if (recommendations.length === 0) {
    recommendations.push('No significant compliance issues detected in the audit period.');
  }

  return recommendations;
}

export default router;
