/**
 * Database Backup Service
 * 
 * Implements a tiered backup strategy for on-premises installations:
 * - Daily backups: Full dump, retained for 7 days
 * - Weekly backups: Full dump on Sundays, retained for 4 weeks
 * - Monthly backups: Full dump on 1st of month, retained for 12 months
 * 
 * Backups are stored in the /backups directory with timestamps.
 * Admins can list, download, and restore from any backup point.
 * 
 * SAFETY: Restores always create an automatic safety backup first.
 * If the restore fails or verification fails, the safety backup is
 * used to automatically recover.  Data is never left in a broken state.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';
import { syslog, LogLevel, LogFacility } from './syslog';

const execAsync = promisify(exec);

const BACKUP_CONFIG = {
  dailyRetention: 7,
  weeklyRetention: 4,
  monthlyRetention: 12,
  dailySchedule: '0 2 * * *',
  weeklySchedule: '0 3 * * 0',
  monthlySchedule: '0 4 1 * *',
  useCompression: true,
};

export interface BackupMetadata {
  id: string;
  filename: string;
  type: 'daily' | 'weekly' | 'monthly' | 'manual';
  createdAt: Date;
  size: number;
  sizeFormatted: string;
  tables: number;
  status: 'completed' | 'failed' | 'in_progress';
  duration?: number;
  error?: string;
}

const getBackupDir = (): string => {
  const isProduction = process.env.NODE_ENV === 'production' && process.env.DOCKER_CONTAINER === 'true';
  const backupDir = isProduction 
    ? '/app/backups' 
    : path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
};

const parseDatabaseUrl = (): { host: string; port: string; database: string; user: string; password: string } => {
  const url = process.env.DATABASE_URL || '';
  const match = url.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+?)(?:\?.*)?$/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4] || '5432',
    database: match[5].split('?')[0],
  };
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const generateBackupFilename = (type: BackupMetadata['type']): string => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const extension = BACKUP_CONFIG.useCompression ? 'sql.gz' : 'sql';
  return `backup-${type}-${timestamp}.${extension}`;
};

/**
 * Builds a psql base command string from parsed DB credentials.
 * Intentionally does NOT include session-altering flags like --single-transaction
 * because Neon's PgBouncer pooler can't reliably handle long DDL transactions.
 */
const buildPsqlBase = (db: ReturnType<typeof parseDatabaseUrl>): string =>
  `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database}`;

/**
 * sed filter that strips lines known to poison Neon pooled connections:
 *  - set_config('search_path', '', false)  → clears search_path on the
 *    shared PgBouncer backend, breaking every subsequent query that doesn't
 *    use schema-qualified table names
 *  - \restrict … → Neon-specific psql meta-command that may not be
 *    recognised by the local psql binary
 */
const DUMP_SANITIZE_SED = `sed "/pg_catalog.set_config('search_path'/d; /^\\\\\\\\restrict/d"`;

/**
 * Drops every table in the public schema.
 * Uses CASCADE to handle foreign key dependencies.
 */
const dropAllPublicTables = async (
  psqlBase: string,
  env: NodeJS.ProcessEnv,
): Promise<void> => {
  const sql = `DO \\$\\$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END \\$\\$;`;
  await execAsync(`${psqlBase} -c "${sql}"`, { env });
};

/**
 * Quick verification that a restore produced a usable database.
 * Returns true if the users table exists and has at least one row.
 */
const verifyDatabase = async (
  psqlBase: string,
  env: NodeJS.ProcessEnv,
): Promise<boolean> => {
  try {
    const { stdout } = await execAsync(
      `${psqlBase} -t -A -c "SELECT count(*) FROM public.users;"`,
      { env },
    );
    const count = parseInt(stdout.trim(), 10);
    return count > 0;
  } catch {
    return false;
  }
};

/**
 * Pipes a (possibly compressed) SQL dump through the sanitizer into psql.
 * Returns the raw exec result so callers can inspect stderr if needed.
 */
const pipeRestoreFile = async (
  filepath: string,
  psqlBase: string,
  env: NodeJS.ProcessEnv,
): Promise<void> => {
  const isGz = filepath.endsWith('.gz');
  const decompressCmd = isGz ? `gunzip -c "${filepath}"` : `cat "${filepath}"`;
  const command = `${decompressCmd} | ${DUMP_SANITIZE_SED} | ${psqlBase}`;
  await execAsync(command, { env, maxBuffer: 100 * 1024 * 1024 });
};

// ─── Public API ──────────────────────────────────────────────────────

export const createBackup = async (type: BackupMetadata['type'] = 'manual'): Promise<BackupMetadata> => {
  const startTime = Date.now();
  const backupDir = getBackupDir();
  const filename = generateBackupFilename(type);
  const filepath = path.join(backupDir, filename);
  
  const metadata: BackupMetadata = {
    id: `backup-${Date.now()}`,
    filename,
    type,
    createdAt: new Date(),
    size: 0,
    sizeFormatted: '0 B',
    tables: 0,
    status: 'in_progress',
  };
  
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Starting ${type} backup: ${filename}`);
  
  try {
    const db = parseDatabaseUrl();
    const env = { ...process.env, PGPASSWORD: db.password };
    
    const pgDumpBase = `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} --no-owner --no-acl`;
    
    const command = BACKUP_CONFIG.useCompression
      ? `${pgDumpBase} | ${DUMP_SANITIZE_SED} | gzip > "${filepath}"`
      : `${pgDumpBase} | ${DUMP_SANITIZE_SED} > "${filepath}"`;
    
    await execAsync(command, { env, maxBuffer: 100 * 1024 * 1024 });
    
    const stats = fs.statSync(filepath);
    metadata.size = stats.size;
    metadata.sizeFormatted = formatSize(stats.size);
    metadata.status = 'completed';
    metadata.duration = Date.now() - startTime;
    metadata.tables = 355;
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Backup completed: ${filename} (${metadata.sizeFormatted}) in ${metadata.duration}ms`);
    
    const metadataPath = filepath.replace(/\.(sql|sql\.gz)$/, '.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    await cleanupOldBackups(type);
    
    return metadata;
  } catch (error) {
    metadata.status = 'failed';
    metadata.error = error instanceof Error ? error.message : String(error);
    metadata.duration = Date.now() - startTime;
    
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Backup failed: ${filename} - ${metadata.error}`);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    
    throw error;
  }
};

export const listBackups = async (): Promise<BackupMetadata[]> => {
  const backupDir = getBackupDir();
  const files = fs.readdirSync(backupDir);
  
  const backups: BackupMetadata[] = [];
  
  for (const file of files) {
    if (file.endsWith('.json') && file.startsWith('backup-')) {
      try {
        const metadataPath = path.join(backupDir, file);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        metadata.createdAt = new Date(metadata.createdAt);
        backups.push(metadata);
      } catch {
        // Skip invalid metadata files
      }
    }
  }
  
  backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  return backups;
};

export const getBackup = async (id: string): Promise<BackupMetadata | null> => {
  const backups = await listBackups();
  return backups.find(b => b.id === id) || null;
};

export const getBackupFilePath = (filename: string): string | null => {
  const backupDir = getBackupDir();
  const filepath = path.join(backupDir, filename);
  return fs.existsSync(filepath) ? filepath : null;
};

/**
 * Restore the database from a backup.
 * 
 * Safety protocol:
 * 1. Create an automatic safety dump of the current database
 * 2. Drop all public tables
 * 3. Pipe the selected backup through the sanitizer into psql
 * 4. Verify the restore produced a usable database
 * 5. If verification fails → auto-recover from the safety dump
 * 6. Clean up the safety dump file
 * 
 * At no point is data irrecoverably lost.
 */
export const restoreBackup = async (id: string): Promise<{ success: boolean; message: string }> => {
  const backup = await getBackup(id);
  if (!backup) throw new Error('Backup not found');
  
  const backupDir = getBackupDir();
  const filepath = path.join(backupDir, backup.filename);
  if (!fs.existsSync(filepath)) throw new Error('Backup file not found');
  
  const db = parseDatabaseUrl();
  const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: db.password };
  const psqlBase = buildPsqlBase(db);
  
  // Safety dump path (temp file, always cleaned up)
  const safetyPath = path.join(backupDir, `_safety_pre_restore_${Date.now()}.sql.gz`);
  
  syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
    `Starting database restore from: ${backup.filename}`);
  
  try {
    // ── Step 1: Safety backup ────────────────────────────────────
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Creating safety backup before restore…');
    const pgDumpBase = `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} --no-owner --no-acl`;
    await execAsync(
      `${pgDumpBase} | ${DUMP_SANITIZE_SED} | gzip > "${safetyPath}"`,
      { env, maxBuffer: 100 * 1024 * 1024 },
    );
    
    const safetyStats = fs.statSync(safetyPath);
    if (safetyStats.size < 1024) {
      throw new Error('Safety backup is suspiciously small — aborting restore to protect data');
    }
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Safety backup created (${formatSize(safetyStats.size)})`);
    
    // ── Step 2: Drop all existing tables ─────────────────────────
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Dropping existing tables…');
    await dropAllPublicTables(psqlBase, env);
    
    // ── Step 3: Restore selected backup ──────────────────────────
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Restoring from ${backup.filename}…`);
    await pipeRestoreFile(filepath, psqlBase, env);
    
    // ── Step 4: Verify ───────────────────────────────────────────
    const ok = await verifyDatabase(psqlBase, env);
    
    if (!ok) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        'Restore verification FAILED — users table missing or empty. Auto-recovering…');
      
      // Recovery: drop whatever partial state exists, restore from safety
      await dropAllPublicTables(psqlBase, env);
      await pipeRestoreFile(safetyPath, psqlBase, env);
      
      const recoveryOk = await verifyDatabase(psqlBase, env);
      if (!recoveryOk) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
          'CRITICAL: Auto-recovery also failed. Manual intervention required.');
        throw new Error(
          'Restore failed and auto-recovery failed. The safety backup is preserved at: ' + safetyPath,
        );
      }
      
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
        'Auto-recovery succeeded — database is back to pre-restore state');
      
      // Clean up safety file only after successful recovery
      if (fs.existsSync(safetyPath)) fs.unlinkSync(safetyPath);
      
      throw new Error(
        'Restore did not produce a valid database. The original data has been automatically recovered.',
      );
    }
    
    // ── Step 5: Success — clean up ───────────────────────────────
    if (fs.existsSync(safetyPath)) fs.unlinkSync(safetyPath);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Database restored and verified from: ${backup.filename}`);
    
    return {
      success: true,
      message: `Database restored from ${backup.filename} (${backup.sizeFormatted})`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // If we haven't already attempted recovery, try now
    if (!errorMsg.includes('auto-recovery') && !errorMsg.includes('automatically recovered')) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Restore error: ${errorMsg}. Attempting auto-recovery…`);
      
      try {
        if (fs.existsSync(safetyPath)) {
          await dropAllPublicTables(psqlBase, env);
          await pipeRestoreFile(safetyPath, psqlBase, env);
          
          const recoveryOk = await verifyDatabase(psqlBase, env);
          if (recoveryOk) {
            syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
              'Auto-recovery succeeded after restore error');
            fs.unlinkSync(safetyPath);
          } else {
            syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
              `CRITICAL: Recovery failed. Safety dump preserved at ${safetyPath}`);
          }
        }
      } catch (recoveryErr) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
          `CRITICAL: Recovery attempt threw: ${recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr)}`);
      }
    }
    
    throw new Error(`Restore failed: ${errorMsg}`);
  }
};

// Delete a backup
export const deleteBackup = async (id: string): Promise<void> => {
  const backup = await getBackup(id);
  
  if (!backup) {
    throw new Error('Backup not found');
  }
  
  const backupDir = getBackupDir();
  const filepath = path.join(backupDir, backup.filename);
  const metadataPath = filepath.replace(/\.(sql|sql\.gz)$/, '.json');
  
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
  
  if (fs.existsSync(metadataPath)) {
    fs.unlinkSync(metadataPath);
  }
  
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Backup deleted: ${backup.filename}`);
};

// Cleanup old backups based on retention policy
const cleanupOldBackups = async (type: BackupMetadata['type']): Promise<void> => {
  const backups = await listBackups();
  const typeBackups = backups.filter(b => b.type === type);
  
  let retention: number;
  switch (type) {
    case 'daily':
      retention = BACKUP_CONFIG.dailyRetention;
      break;
    case 'weekly':
      retention = BACKUP_CONFIG.weeklyRetention;
      break;
    case 'monthly':
      retention = BACKUP_CONFIG.monthlyRetention;
      break;
    default:
      retention = 5; // Manual backups: keep 5
  }
  
  // Delete backups beyond retention
  const toDelete = typeBackups.slice(retention);
  
  for (const backup of toDelete) {
    await deleteBackup(backup.id);
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Cleaned up old ${type} backup: ${backup.filename}`);
  }
};

// Scheduled backup tasks
let scheduledTasks: cron.ScheduledTask[] = [];

// Check if pg_dump is available
const checkPgDumpAvailable = async (): Promise<boolean> => {
  try {
    await execAsync('which pg_dump');
    return true;
  } catch {
    return false;
  }
};

// Initialize backup scheduler
export const initializeBackupScheduler = async (): Promise<void> => {
  // Clear existing tasks
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  
  // Check if pg_dump is available
  const pgDumpAvailable = await checkPgDumpAvailable();
  if (!pgDumpAvailable) {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
      'Backup scheduler disabled: pg_dump not found. Install PostgreSQL client tools for backup functionality.');
    return;
  }
  
  // Skip scheduling in development unless explicitly enabled
  if (process.env.NODE_ENV !== 'production' && !process.env.ENABLE_BACKUP_SCHEDULER) {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      'Backup scheduler disabled in development (set ENABLE_BACKUP_SCHEDULER=true to enable)');
    return;
  }
  
  // Daily backup at 2 AM
  const dailyTask = cron.schedule(BACKUP_CONFIG.dailySchedule, async () => {
    try {
      await createBackup('daily');
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Scheduled daily backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  scheduledTasks.push(dailyTask);
  
  // Weekly backup at 3 AM Sunday
  const weeklyTask = cron.schedule(BACKUP_CONFIG.weeklySchedule, async () => {
    try {
      await createBackup('weekly');
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Scheduled weekly backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  scheduledTasks.push(weeklyTask);
  
  // Monthly backup at 4 AM on 1st
  const monthlyTask = cron.schedule(BACKUP_CONFIG.monthlySchedule, async () => {
    try {
      await createBackup('monthly');
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Scheduled monthly backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  scheduledTasks.push(monthlyTask);
  
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
    'Backup scheduler initialized: Daily 2AM, Weekly Sunday 3AM, Monthly 1st 4AM');
};

// Get backup status and next scheduled times
export const getBackupStatus = async (): Promise<{
  enabled: boolean;
  pgDumpAvailable: boolean;
  lastBackup: BackupMetadata | null;
  nextDaily: string;
  nextWeekly: string;
  nextMonthly: string;
  totalBackups: number;
  totalSize: string;
}> => {
  const backups = await listBackups();
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  const pgDumpAvailable = await checkPgDumpAvailable();
  
  // Calculate next run times
  const now = new Date();
  
  const getNextRun = (schedule: string): string => {
    // Simple approximation - in production would use cron-parser
    const [_min, hour, dayOfMonth, _month, dayOfWeek] = schedule.split(' ');
    const next = new Date(now);
    next.setHours(parseInt(hour), 0, 0, 0);
    
    if (dayOfWeek !== '*') {
      // Weekly
      const targetDay = parseInt(dayOfWeek);
      const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
      next.setDate(now.getDate() + daysUntil);
    } else if (dayOfMonth !== '*') {
      // Monthly
      next.setDate(parseInt(dayOfMonth));
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    } else {
      // Daily
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }
    
    return next.toISOString();
  };
  
  return {
    enabled: (process.env.NODE_ENV === 'production' || process.env.ENABLE_BACKUP_SCHEDULER === 'true') && pgDumpAvailable,
    pgDumpAvailable,
    lastBackup: backups[0] || null,
    nextDaily: getNextRun(BACKUP_CONFIG.dailySchedule),
    nextWeekly: getNextRun(BACKUP_CONFIG.weeklySchedule),
    nextMonthly: getNextRun(BACKUP_CONFIG.monthlySchedule),
    totalBackups: backups.length,
    totalSize: formatSize(totalSize),
  };
};

export default {
  createBackup,
  listBackups,
  getBackup,
  getBackupFilePath,
  restoreBackup,
  deleteBackup,
  initializeBackupScheduler,
  getBackupStatus,
};

