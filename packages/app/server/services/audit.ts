/**
 * Audit Service for EdSteward Compliance Management
 * Provides comprehensive audit trail functionality for compliance actions
 */

import { Request } from 'express';
import { db } from '../db';
import { auditLogs, type InsertAuditLog, type AuditLog } from '@shared/schema';
import { eq, and, desc, gte, lte, ilike, or, sql, count } from 'drizzle-orm';
import { syslog, LogLevel, LogFacility } from './syslog';

export interface AuditContext {
  userId?: number;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'view';
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  regulationId?: number;
  complianceImpact?: 'high' | 'medium' | 'low';
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
}

export interface AuditQueryOptions {
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: number;
  regulationId?: number;
  startDate?: Date;
  endDate?: Date;
  complianceImpact?: string;
  riskLevel?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export class AuditService {
  /**
   * Log an audit entry for compliance tracking
   */
  static async logAudit(entry: AuditEntry, context: AuditContext): Promise<AuditLog> {
    try {
      // Calculate changes if both previous and new values are provided
      const changes = this.calculateChanges(entry.previousValues, entry.newValues);

      // Determine compliance impact if not provided
      const complianceImpact = entry.complianceImpact || this.determineComplianceImpact(entry);
      
      // Determine risk level if not provided
      const riskLevel = entry.riskLevel || this.determineRiskLevel(entry, complianceImpact);

      const auditLogEntry: InsertAuditLog = {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        userId: context.userId,
        userEmail: context.userEmail,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        requestId: context.requestId,
        previousValues: entry.previousValues,
        newValues: entry.newValues,
        changes,
        regulationId: entry.regulationId,
        complianceImpact,
        riskLevel,
        metadata: entry.metadata,
      };

      const [auditLog] = await db.insert(auditLogs).values(auditLogEntry).returning();

      // Also log to syslog for additional tracking
      syslog.logAuditEvent(LogLevel.INFO, 
        `Audit: ${entry.action} ${entry.entityType} ${entry.entityId}`, 
        {
          userId: context.userId,
          userEmail: context.userEmail,
          complianceImpact,
          riskLevel,
          regulationId: entry.regulationId,
          auditLogId: auditLog.id
        }
      );

      return auditLog;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Failed to create audit log: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Query audit logs with filtering options
   */
  static async queryAuditLogs(options: AuditQueryOptions = {}): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    try {
      const conditions = [];

      if (options.entityType) {
        conditions.push(eq(auditLogs.entityType, options.entityType));
      }

      if (options.entityId) {
        conditions.push(eq(auditLogs.entityId, options.entityId));
      }

      if (options.action) {
        conditions.push(eq(auditLogs.action, options.action as any));
      }

      if (options.userId) {
        conditions.push(eq(auditLogs.userId, options.userId));
      }

      if (options.regulationId) {
        conditions.push(eq(auditLogs.regulationId, options.regulationId));
      }

      if (options.startDate) {
        conditions.push(gte(auditLogs.timestamp, options.startDate));
      }

      if (options.endDate) {
        conditions.push(lte(auditLogs.timestamp, options.endDate));
      }

      if (options.complianceImpact) {
        conditions.push(eq(auditLogs.complianceImpact, options.complianceImpact));
      }

      if (options.riskLevel) {
        conditions.push(eq(auditLogs.riskLevel, options.riskLevel));
      }

      if (options.search) {
        conditions.push(
          or(
            ilike(auditLogs.entityType, `%${options.search}%`),
            ilike(auditLogs.entityId, `%${options.search}%`),
            ilike(auditLogs.userEmail, `%${options.search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : sql`1=1`;

      // Get total count
      const [{ total }] = await db
        .select({ total: count() })
        .from(auditLogs)
        .where(whereClause);

      // Get logs with pagination
      const logs = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.timestamp))
        .limit(options.limit || 50)
        .offset(options.offset || 0);

      return {
        logs,
        total: Number(total)
      };
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Failed to query audit logs: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get audit trail for a specific entity
   */
  static async getEntityAuditTrail(entityType: string, entityId: string): Promise<AuditLog[]> {
    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId)
        ))
        .orderBy(desc(auditLogs.timestamp));

      return logs;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Failed to get entity audit trail: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get audit summary for compliance reporting
   */
  static async getAuditSummary(startDate?: Date, endDate?: Date): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByEntity: Record<string, number>;
    highRiskActions: number;
    complianceImpactSummary: Record<string, number>;
  }> {
    try {
      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(auditLogs.timestamp, startDate));
      }
      
      if (endDate) {
        conditions.push(lte(auditLogs.timestamp, endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const logs = await db
        .select()
        .from(auditLogs)
        .where(whereClause);

      const summary = {
        totalActions: logs.length,
        actionsByType: {} as Record<string, number>,
        actionsByEntity: {} as Record<string, number>,
        highRiskActions: 0,
        complianceImpactSummary: {} as Record<string, number>
      };

      logs.forEach(log => {
        // Count by action type
        summary.actionsByType[log.action] = (summary.actionsByType[log.action] || 0) + 1;
        
        // Count by entity type
        summary.actionsByEntity[log.entityType] = (summary.actionsByEntity[log.entityType] || 0) + 1;
        
        // Count high risk actions
        if (log.riskLevel === 'critical' || log.riskLevel === 'high') {
          summary.highRiskActions++;
        }
        
        // Count by compliance impact
        if (log.complianceImpact) {
          summary.complianceImpactSummary[log.complianceImpact] = 
            (summary.complianceImpactSummary[log.complianceImpact] || 0) + 1;
        }
      });

      return summary;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Failed to get audit summary: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Extract audit context from Express request
   */
  static extractAuditContext(req: Request): AuditContext {
    return {
      userId: req.user?.id,
      userEmail: req.user?.email,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sessionId: req.sessionID,
      requestId: req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * Calculate changes between previous and new values
   */
  private static calculateChanges(
    previousValues?: Record<string, any>, 
    newValues?: Record<string, any>
  ): Record<string, { old: any; new: any }> | undefined {
    if (!previousValues || !newValues) {
      return undefined;
    }

    const changes: Record<string, { old: any; new: any }> = {};
    const allKeys = new Set([...Object.keys(previousValues), ...Object.keys(newValues)]);

    for (const key of allKeys) {
      const oldValue = previousValues[key];
      const newValue = newValues[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { old: oldValue, new: newValue };
      }
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  /**
   * Determine compliance impact based on the audit entry
   */
  private static determineComplianceImpact(entry: AuditEntry): 'high' | 'medium' | 'low' {
    // High impact actions
    if (entry.entityType === 'regulation_action' && entry.action === 'update') {
      return 'high';
    }
    
    if (entry.entityType === 'deadline' && ['create', 'update', 'delete'].includes(entry.action)) {
      return 'high';
    }

    // Medium impact actions
    if (entry.entityType === 'note' && entry.action === 'delete') {
      return 'medium';
    }

    if (entry.entityType === 'evidence' && ['create', 'delete'].includes(entry.action)) {
      return 'medium';
    }

    // Default to low impact
    return 'low';
  }

  /**
   * Determine risk level based on the audit entry and compliance impact
   */
  private static determineRiskLevel(entry: AuditEntry, complianceImpact: string): 'critical' | 'high' | 'medium' | 'low' {
    // Critical risk for regulation action status changes
    if (entry.entityType === 'regulation_action' && 
        entry.newValues?.status === 'completed' && 
        entry.previousValues?.status !== 'completed') {
      return 'critical';
    }

    // High risk for deadline deletions
    if (entry.entityType === 'deadline' && entry.action === 'delete') {
      return 'high';
    }

    // Map compliance impact to risk level
    switch (complianceImpact) {
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }
}

export default AuditService;
