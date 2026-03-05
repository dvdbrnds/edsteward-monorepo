/**
 * Backup Management API Routes
 * 
 * Provides endpoints for:
 * - Listing all backups
 * - Creating manual backups
 * - Restoring from backups
 * - Downloading backup files
 * - Deleting backups
 * - Getting backup status/schedule
 */

import express from 'express';
import backupService from '../../services/backup-service';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';

const router = express.Router();

// Auth middleware - require admin role
const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// GET /api/backups - List all backups
router.get('/', requireAdmin, async (_req, res) => {
  try {
    const backups = await backupService.listBackups();
    
    res.json({
      success: true,
      backups,
      count: backups.length,
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to list backups: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      error: 'Failed to list backups',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/backups/status - Get backup status and schedule
router.get('/status', requireAdmin, async (_req, res) => {
  try {
    const status = await backupService.getBackupStatus();
    
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to get backup status: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      error: 'Failed to get backup status',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/backups - Create a manual backup
router.post('/', requireAdmin, async (req, res) => {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Manual backup initiated by user: ${req.user?.username || 'unknown'}`);
    
    const backup = await backupService.createBackup('manual');
    
    res.json({
      success: true,
      message: 'Backup created successfully',
      backup,
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Manual backup failed: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      error: 'Failed to create backup',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/backups/:id - Get backup details
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const backup = await backupService.getBackup(req.params.id);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    res.json({
      success: true,
      backup,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get backup',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/backups/:id/download - Download backup file
router.get('/:id/download', requireAdmin, async (req, res) => {
  try {
    const backup = await backupService.getBackup(req.params.id);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    const filepath = backupService.getBackupFilePath(backup.filename);
    
    if (!filepath) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Backup download: ${backup.filename} by ${req.user?.username || 'unknown'}`);
    
    res.download(filepath, backup.filename);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to download backup',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/backups/:id/restore - Restore from backup
router.post('/:id/restore', requireAdmin, async (req, res) => {
  try {
    const backup = await backupService.getBackup(req.params.id);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
      `Database restore initiated by ${req.user?.username || 'unknown'} from: ${backup.filename}`);
    
    const result = await backupService.restoreBackup(req.params.id);
    
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Restore failed: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      error: 'Failed to restore backup',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// DELETE /api/backups/:id - Delete a backup
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const backup = await backupService.getBackup(req.params.id);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    await backupService.deleteBackup(req.params.id);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Backup deleted: ${backup.filename} by ${req.user?.username || 'unknown'}`);
    
    res.json({
      success: true,
      message: 'Backup deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete backup',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

