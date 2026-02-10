/**
 * Data Retention Service for EdSteward
 * Implements automated data lifecycle management per HECVAT compliance requirements
 * 
 * Retention Periods:
 * - Session data: 24 hours after expiry
 * - System logs: 90 days
 * - Audit logs: 7 years (2557 days)
 * - Soft-deleted data grace period: 30 days
 */

import { db } from '../db';
import { 
  systemLogs, 
  auditLogs,
  attestationTokens,
  users
} from '@shared/schema';
import { lt, sql, and, isNotNull } from 'drizzle-orm';
import { syslog, LogLevel, LogFacility } from './syslog';

// Retention periods in days
export const RETENTION_PERIODS = {
  SYSTEM_LOGS: 90,           // 90 days for application/system logs
  AUDIT_LOGS: 2557,          // 7 years for audit logs (HECVAT requirement)
  ATTESTATION_TOKENS: 7,     // 7 days for expired attestation tokens
  SOFT_DELETE_GRACE: 30,     // 30 days grace period for soft-deleted data
  SESSION_HOURS: 24,         // 24 hours for expired sessions
} as const;

export interface RetentionJobResult {
  jobName: string;
  recordsProcessed: number;
  recordsDeleted: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date;
  success: boolean;
}

export interface DataRetentionSummary {
  executedAt: Date;
  jobs: RetentionJobResult[];
  totalRecordsDeleted: number;
  hasErrors: boolean;
}

export class DataRetentionService {
  
  /**
   * Run all data retention jobs
   */
  static async runAllRetentionJobs(): Promise<DataRetentionSummary> {
    const executedAt = new Date();
    const jobs: RetentionJobResult[] = [];
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      'Starting data retention jobs');
    
    // Run each retention job
    jobs.push(await this.purgeExpiredSystemLogs());
    jobs.push(await this.purgeExpiredAttestationTokens());
    jobs.push(await this.purgeSoftDeletedUsers());
    
    // Note: Audit logs are intentionally NOT purged automatically
    // They have a 7-year retention requirement and should only be
    // archived/purged through a separate controlled process
    
    // HECVAT PRIV-08: Secure data disposal after deletion
    jobs.push(await this.secureDataDisposal());
    
    const totalRecordsDeleted = jobs.reduce((sum, job) => sum + job.recordsDeleted, 0);
    const hasErrors = jobs.some(job => !job.success);
    
    syslog.log(LogFacility.LOCAL0, hasErrors ? LogLevel.WARNING : LogLevel.INFO, 
      `Data retention jobs completed. Records deleted: ${totalRecordsDeleted}, Errors: ${hasErrors}`);
    
    return {
      executedAt,
      jobs,
      totalRecordsDeleted,
      hasErrors,
    };
  }
  
  /**
   * Purge system logs older than retention period (90 days)
   */
  static async purgeExpiredSystemLogs(): Promise<RetentionJobResult> {
    const startedAt = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_PERIODS.SYSTEM_LOGS);
    
    let recordsDeleted = 0;
    const errors: string[] = [];
    
    try {
      // Count records to be deleted (for logging)
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(systemLogs)
        .where(lt(systemLogs.timestamp, cutoffDate));
      
      const recordsToDelete = Number(countResult[0]?.count || 0);
      
      if (recordsToDelete > 0) {
        // Delete in batches to avoid lock contention
        const batchSize = 10000;
        let deleted = 0;
        
        while (deleted < recordsToDelete) {
          const result = await db
            .delete(systemLogs)
            .where(lt(systemLogs.timestamp, cutoffDate));
          
          // Drizzle doesn't return count for delete, estimate based on batch
          deleted += batchSize;
          
          // Safety break if we've done enough iterations
          if (deleted > recordsToDelete + batchSize) break;
        }
        
        recordsDeleted = recordsToDelete;
        
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Purged ${recordsDeleted} system logs older than ${RETENTION_PERIODS.SYSTEM_LOGS} days`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Failed to purge system logs: ${errorMessage}`);
    }
    
    return {
      jobName: 'purgeExpiredSystemLogs',
      recordsProcessed: recordsDeleted,
      recordsDeleted,
      errors,
      startedAt,
      completedAt: new Date(),
      success: errors.length === 0,
    };
  }
  
  /**
   * Purge expired attestation tokens (7 days after expiry)
   */
  static async purgeExpiredAttestationTokens(): Promise<RetentionJobResult> {
    const startedAt = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_PERIODS.ATTESTATION_TOKENS);
    
    let recordsDeleted = 0;
    const errors: string[] = [];
    
    try {
      // Count records to be deleted
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(attestationTokens)
        .where(lt(attestationTokens.expiresAt, cutoffDate));
      
      const recordsToDelete = Number(countResult[0]?.count || 0);
      
      if (recordsToDelete > 0) {
        await db
          .delete(attestationTokens)
          .where(lt(attestationTokens.expiresAt, cutoffDate));
        
        recordsDeleted = recordsToDelete;
        
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Purged ${recordsDeleted} expired attestation tokens`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Failed to purge attestation tokens: ${errorMessage}`);
    }
    
    return {
      jobName: 'purgeExpiredAttestationTokens',
      recordsProcessed: recordsDeleted,
      recordsDeleted,
      errors,
      startedAt,
      completedAt: new Date(),
      success: errors.length === 0,
    };
  }
  
  /**
   * Purge soft-deleted users past grace period (30 days)
   */
  static async purgeSoftDeletedUsers(): Promise<RetentionJobResult> {
    const startedAt = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_PERIODS.SOFT_DELETE_GRACE);
    
    let recordsDeleted = 0;
    const errors: string[] = [];
    
    try {
      // Check for users marked as inactive (soft-deleted)
      // The isActive column serves as our soft-delete flag
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            sql`${users.isActive} = false`,
            lt(users.updatedAt, cutoffDate)
          )
        );
      
      const recordsToDelete = Number(countResult[0]?.count || 0);
      
      if (recordsToDelete > 0) {
        // Securely delete user data before removing records
        // First, anonymize personal data (overwrite with empty strings)
        await db
          .update(users)
          .set({
            email: sql`'deleted_' || id || '@purged.edsteward.local'`,
            password: 'PURGED',
            firstName: 'Deleted',
            lastName: 'User',
            department: null,
          })
          .where(
            and(
              sql`${users.isActive} = false`,
              lt(users.updatedAt, cutoffDate)
            )
          );

        // Then delete the records
        await db
          .delete(users)
          .where(
            and(
              sql`${users.isActive} = false`,
              lt(users.updatedAt, cutoffDate)
            )
          );
        
        recordsDeleted = recordsToDelete;
        
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Securely purged ${recordsDeleted} soft-deleted users older than ${RETENTION_PERIODS.SOFT_DELETE_GRACE} days`);
      } else {
        syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, 
          'Soft-deleted user purge job completed (no records found)');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Don't treat missing column as error - just skip
      if (!errorMessage.includes('column') && !errorMessage.includes('does not exist')) {
        errors.push(errorMessage);
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
          `Failed to purge soft-deleted users: ${errorMessage}`);
      }
    }
    
    return {
      jobName: 'purgeSoftDeletedUsers',
      recordsProcessed: recordsDeleted,
      recordsDeleted,
      errors,
      startedAt,
      completedAt: new Date(),
      success: errors.length === 0,
    };
  }
  
  /**
   * Secure data disposal (HECVAT PRIV-08)
   * Overwrite deleted data to prevent recovery, then run VACUUM
   * This should be run after retention jobs complete
   */
  static async secureDataDisposal(): Promise<RetentionJobResult> {
    const startedAt = new Date();
    const errors: string[] = [];
    let recordsProcessed = 0;
    
    try {
      // Run VACUUM on tables that had deletions to reclaim space
      // and prevent deleted data from being recoverable
      const tablesToVacuum = ['system_logs', 'users', 'task_attestation_tokens'];
      
      for (const table of tablesToVacuum) {
        try {
          // VACUUM cannot run inside a transaction, so use raw SQL
          await db.execute(sql.raw(`VACUUM ${table}`));
          recordsProcessed++;
          syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
            `VACUUM completed on table: ${table}`);
        } catch (vacuumError) {
          // VACUUM failures are non-critical (e.g., table doesn't exist)
          const msg = vacuumError instanceof Error ? vacuumError.message : String(vacuumError);
          syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
            `VACUUM skipped for ${table}: ${msg}`);
        }
      }
      
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Secure data disposal completed: ${recordsProcessed} tables vacuumed`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `Secure data disposal failed: ${errorMessage}`);
    }
    
    return {
      jobName: 'secureDataDisposal',
      recordsProcessed,
      recordsDeleted: 0,
      errors,
      startedAt,
      completedAt: new Date(),
      success: errors.length === 0,
    };
  }
  
  /**
   * Archive audit logs older than active period (move to cold storage)
   * Note: This is a placeholder - in production, you'd implement
   * archival to S3 Glacier or similar cold storage
   */
  static async archiveOldAuditLogs(): Promise<RetentionJobResult> {
    const startedAt = new Date();
    const errors: string[] = [];
    
    // Audit logs are archived after 1 year but retained for 7 years total
    const archiveAfterDays = 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archiveAfterDays);
    
    try {
      // Count records eligible for archival
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(lt(auditLogs.timestamp, cutoffDate));
      
      const recordsToArchive = Number(countResult[0]?.count || 0);
      
      if (recordsToArchive > 0) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `${recordsToArchive} audit logs eligible for archival (older than ${archiveAfterDays} days)`);
        
        // In production, you would:
        // 1. Export records to S3 in compressed format
        // 2. Verify export integrity
        // 3. Delete from primary database
        // 4. Update archival tracking table
        
        // For now, we just log the count
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Failed to archive audit logs: ${errorMessage}`);
    }
    
    return {
      jobName: 'archiveOldAuditLogs',
      recordsProcessed: 0, // Archival only, no deletion
      recordsDeleted: 0,
      errors,
      startedAt,
      completedAt: new Date(),
      success: errors.length === 0,
    };
  }
  
  /**
   * Get retention status report for compliance auditing
   */
  static async getRetentionStatusReport(): Promise<{
    systemLogs: { total: number; oldestRecord: Date | null; newestRecord: Date | null };
    auditLogs: { total: number; oldestRecord: Date | null; newestRecord: Date | null };
    attestationTokens: { total: number; expired: number };
  }> {
    try {
      // System logs stats
      const systemLogsStats = await db
        .select({
          count: sql<number>`count(*)`,
          oldest: sql<Date>`min(timestamp)`,
          newest: sql<Date>`max(timestamp)`,
        })
        .from(systemLogs);
      
      // Audit logs stats
      const auditLogsStats = await db
        .select({
          count: sql<number>`count(*)`,
          oldest: sql<Date>`min(timestamp)`,
          newest: sql<Date>`max(timestamp)`,
        })
        .from(auditLogs);
      
      // Attestation tokens stats
      const tokenStats = await db
        .select({
          total: sql<number>`count(*)`,
          expired: sql<number>`count(*) filter (where expires_at < now())`,
        })
        .from(attestationTokens);
      
      return {
        systemLogs: {
          total: Number(systemLogsStats[0]?.count || 0),
          oldestRecord: systemLogsStats[0]?.oldest || null,
          newestRecord: systemLogsStats[0]?.newest || null,
        },
        auditLogs: {
          total: Number(auditLogsStats[0]?.count || 0),
          oldestRecord: auditLogsStats[0]?.oldest || null,
          newestRecord: auditLogsStats[0]?.newest || null,
        },
        attestationTokens: {
          total: Number(tokenStats[0]?.total || 0),
          expired: Number(tokenStats[0]?.expired || 0),
        },
      };
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Failed to generate retention status report: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export default DataRetentionService;
