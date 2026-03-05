/**
 * Audit Middleware for EdSteward
 * Automatically logs compliance-related actions for audit trail
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit';
import { syslog, LogLevel, LogFacility } from '../services/syslog';

// Extend Request interface to include audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        entityType?: string;
        entityId?: string;
        previousValues?: Record<string, any>;
        regulationId?: number;
        complianceImpact?: 'high' | 'medium' | 'low';
        riskLevel?: 'critical' | 'high' | 'medium' | 'low';
        metadata?: Record<string, any>;
      };
    }
  }
}

/**
 * Middleware to capture request body for audit logging
 */
export function captureAuditContext(
  entityType: string,
  options: {
    getEntityId?: (req: Request) => string;
    getRegulationId?: (req: Request) => number;
    complianceImpact?: 'high' | 'medium' | 'low';
    riskLevel?: 'critical' | 'high' | 'medium' | 'low';
    captureBody?: boolean;
  } = {}
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.auditContext = {
        entityType,
        entityId: options.getEntityId ? options.getEntityId(req) : req.params.id || req.params.regulationId,
        regulationId: options.getRegulationId ? options.getRegulationId(req) : parseInt(req.params.regulationId),
        complianceImpact: options.complianceImpact,
        riskLevel: options.riskLevel,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          ...(options.captureBody && req.body ? { requestBody: req.body } : {})
        }
      };

      next();
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
        `Failed to capture audit context: ${error instanceof Error ? error.message : String(error)}`
      );
      next(); // Continue even if audit context capture fails
    }
  };
}

/**
 * Middleware to log audit trail after successful operations
 */
export function logAuditTrail(action: 'create' | 'update' | 'delete' | 'view') {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Only log audit if the request was successful (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.auditContext) {
        // Don't await to avoid blocking the response
        logAuditAsync(req, action, body).catch(error => {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
            `Failed to log audit trail: ${error instanceof Error ? error.message : String(error)}`
          );
        });
      }
      
      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Async function to log audit without blocking response
 */
async function logAuditAsync(req: Request, action: string, responseBody: any) {
  if (!req.auditContext) return;

  try {
    const context = AuditService.extractAuditContext(req);
    
    // Determine new values based on action and response
    let newValues: Record<string, any> | undefined;
    if (action === 'create' || action === 'update') {
      newValues = responseBody;
    }

    await AuditService.logAudit({
      entityType: req.auditContext.entityType!,
      entityId: req.auditContext.entityId!,
      action: action as any,
      previousValues: req.auditContext.previousValues,
      newValues,
      regulationId: req.auditContext.regulationId,
      complianceImpact: req.auditContext.complianceImpact,
      riskLevel: req.auditContext.riskLevel,
      metadata: {
        ...req.auditContext.metadata,
        responseStatus: req.res?.statusCode,
        responseSize: JSON.stringify(responseBody).length
      }
    }, context);

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Error in audit logging: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Middleware specifically for regulation action updates
 */
export function auditRegulationAction() {
  return [
    captureAuditContext('regulation_action', {
      getEntityId: (req) => `${req.params.regulationId}_${req.params.actionType}`,
      getRegulationId: (req) => parseInt(req.params.regulationId),
      complianceImpact: 'high',
      riskLevel: 'high',
      captureBody: true
    }),
    logAuditTrail('update')
  ];
}

/**
 * Middleware for deadline operations
 */
export function auditDeadline(action: 'create' | 'update' | 'delete') {
  return [
    captureAuditContext('deadline', {
      getEntityId: (req) => req.params.id || 'new',
      getRegulationId: (req) => parseInt(req.body?.regulationId || req.params.regulationId),
      complianceImpact: 'high',
      riskLevel: action === 'delete' ? 'high' : 'medium',
      captureBody: true
    }),
    logAuditTrail(action)
  ];
}

/**
 * Middleware for note operations
 */
export function auditNote(action: 'create' | 'update' | 'delete') {
  return [
    captureAuditContext('note', {
      getEntityId: (req) => req.params.noteId || 'new',
      getRegulationId: (req) => parseInt(req.body?.regulationId || req.params.regulationId),
      complianceImpact: 'medium',
      riskLevel: 'low',
      captureBody: action !== 'delete'
    }),
    logAuditTrail(action)
  ];
}

/**
 * Middleware for evidence file operations
 */
export function auditEvidence(action: 'create' | 'delete') {
  return [
    captureAuditContext('evidence', {
      getEntityId: (req) => req.params.id || 'new',
      getRegulationId: (req) => parseInt(req.params.regulationId),
      complianceImpact: 'medium',
      riskLevel: 'medium',
      captureBody: false
    }),
    logAuditTrail(action)
  ];
}

export default {
  captureAuditContext,
  logAuditTrail,
  auditRegulationAction,
  auditDeadline,
  auditNote,
  auditEvidence
};
