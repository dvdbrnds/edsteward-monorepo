import express, { type Request, Response } from "express";
import { storage } from "./storage";
import { syslog, LogLevel, LogFacility } from './services/syslog';
import { z } from "zod";
import { ValidationLevel } from "@shared/schema";

/**
 * Sets up the MCP integration API routes
 * This API allows communication between the MCP Orchestrator and the local client
 * @param app Express application
 */
export function setupMCPIntegrationApi(app: express.Application) {
  // Authentication middleware for MCP requests
  const authenticateMCP = async (req: Request, res: Response, next: Function) => {
    const apiKey = req.headers['x-mcp-api-key'];
    
    // In production, you'd validate against stored API keys
    if (!apiKey) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized MCP API request attempt");
      return res.status(401).json({ error: "API key required" });
    }
    
    // For now, we'll use a simple check - in production, use proper key validation
    if (apiKey !== process.env.MCP_API_KEY) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Invalid MCP API key provided");
      return res.status(403).json({ error: "Invalid API key" });
    }
    
    next();
  };
  
  // Validation schemas for API requests
  const regulationVersionSchema = z.object({
    regulationId: z.number(),
    content: z.string(),
    source: z.string(),
    sourceId: z.string().optional(),
    validationStatus: z.array(z.object({
      level: z.nativeEnum(ValidationLevel),
      passed: z.boolean(),
      errors: z.array(z.object({
        field: z.string(),
        message: z.string(),
        code: z.string(),
        severity: z.enum(['warning', 'error', 'critical'])
      })),
      validatedAt: z.coerce.date(),
      validatedBy: z.number().optional()
    })).optional()
  });
  
  const versionConflictSchema = z.object({
    regulationId: z.number(),
    localVersionId: z.number(),
    remoteVersionId: z.string(),
    conflicts: z.array(z.object({
      field: z.string(),
      localValue: z.string(),
      remoteValue: z.string(),
      resolutionStrategy: z.enum(['local', 'remote', 'merge', 'manual'])
    }))
  });
  
  // ----- MCP Integration API Endpoints ------
  
  // Get sync status for all regulations
  app.get('/api/mcp/sync-status', authenticateMCP, async (req: Request, res: Response) => {
    try {
      // Fetch all regulations
      const regulations = await storage.getRegulations();
      
      // Map regulations to their sync status
      const syncStatusPromises = regulations.map(async (regulation) => {
        const syncControl = await storage.getSyncControl(regulation.id);
        return {
          regulationId: regulation.id,
          itemId: regulation.itemId,
          name: regulation.name,
          syncStatus: syncControl || { 
            regulationId: regulation.id,
            syncState: 'idle',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
      });
      
      const syncStatuses = await Promise.all(syncStatusPromises);
      
      res.json(syncStatuses);
    } catch (error) {
      console.error('Error fetching sync statuses:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error fetching MCP sync statuses", { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch sync statuses' });
    }
  });
  
  // Get sync status for a specific regulation
  app.get('/api/mcp/sync-status/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const regulation = await storage.getRegulation(regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: 'Regulation not found' });
      }
      
      const syncControl = await storage.getSyncControl(regulationId);
      
      res.json({
        regulationId: regulation.id,
        itemId: regulation.itemId,
        name: regulation.name,
        syncStatus: syncControl || { 
          regulationId: regulation.id,
          syncState: 'idle',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error(`Error fetching sync status for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching MCP sync status for regulation ${req.params.regulationId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch sync status' });
    }
  });
  
  // Get latest version for a regulation
  app.get('/api/mcp/versions/:regulationId/latest', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const latestVersion = await storage.getLatestRegulationVersion(regulationId);
      
      if (!latestVersion) {
        return res.status(404).json({ error: 'No versions found for this regulation' });
      }
      
      res.json(latestVersion);
    } catch (error) {
      console.error(`Error fetching latest version for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching latest MCP version for regulation ${req.params.regulationId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch latest version' });
    }
  });
  
  // Get all versions for a regulation
  app.get('/api/mcp/versions/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const versions = await storage.getRegulationVersions(regulationId);
      
      res.json(versions);
    } catch (error) {
      console.error(`Error fetching versions for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching MCP versions for regulation ${req.params.regulationId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch versions' });
    }
  });
  
  // Create a new version for a regulation (used when MCP pushes updates)
  app.post('/api/mcp/versions/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      // Validate request body
      const validationResult = regulationVersionSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid version data', 
          details: validationResult.error.format() 
        });
      }
      
      const data = validationResult.data;
      
      // Ensure the regulation exists
      const regulation = await storage.getRegulation(regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: 'Regulation not found' });
      }
      
      // Get the latest version to determine next version number
      const latestVersion = await storage.getLatestRegulationVersion(regulationId);
      const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
      
      // Create the new version
      const newVersion = await storage.createRegulationVersion({
        regulationId,
        versionNumber,
        content: data.content,
        source: data.source,
        sourceId: data.sourceId,
        validationStatus: data.validationStatus,
        createdBy: 1 // System user ID - should be configured appropriately
      });
      
      // Update the sync control to record this sync
      await storage.recordSyncAttempt(regulationId, true);
      
      // Create notification for users about the new version
      await storage.createNotificationQueueItem({
        regulationId,
        type: 'sync_complete',
        content: {
          versionId: newVersion.id,
          versionNumber,
          message: `New version ${versionNumber} received from MCP`
        },
        status: 'pending',
        priority: 'normal'
      });
      
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `New version created for regulation ${regulationId} from MCP`, { 
        versionId: newVersion.id,
        versionNumber 
      });
      
      res.status(201).json(newVersion);
    } catch (error) {
      console.error(`Error creating version for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error creating MCP version for regulation ${req.params.regulationId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to create version' });
    }
  });
  
  // Register a version conflict for a regulation
  app.post('/api/mcp/conflicts/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      // Validate request body
      const validationResult = versionConflictSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid conflict data', 
          details: validationResult.error.format() 
        });
      }
      
      const data = validationResult.data;
      
      // Ensure the regulation exists
      const regulation = await storage.getRegulation(regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: 'Regulation not found' });
      }
      
      // Create the conflict record
      const conflict = await storage.createVersionConflict({
        regulationId,
        localVersionId: data.localVersionId,
        remoteVersionId: data.remoteVersionId,
        conflicts: data.conflicts,
        status: 'pending'
      });
      
      // Create notification for users about the conflict
      await storage.createNotificationQueueItem({
        regulationId,
        type: 'version_conflict',
        content: {
          conflictId: conflict.id,
          message: `Version conflict detected for ${regulation.name}`,
          conflictCount: data.conflicts.length
        },
        status: 'pending',
        priority: 'high'
      });
      
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Version conflict detected for regulation ${regulationId}`, { 
        conflictId: conflict.id,
        conflictCount: data.conflicts.length 
      });
      
      res.status(201).json(conflict);
    } catch (error) {
      console.error(`Error registering conflict for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error registering MCP conflict for regulation ${req.params.regulationId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to register conflict' });
    }
  });
  
  // Get all pending conflicts
  app.get('/api/mcp/conflicts/pending', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const conflicts = await storage.getVersionConflicts('pending');
      
      // Enrich conflicts with regulation details
      const enrichedConflicts = await Promise.all(conflicts.map(async (conflict) => {
        const regulation = await storage.getRegulation(conflict.regulationId);
        return {
          ...conflict,
          regulationName: regulation?.name || 'Unknown Regulation'
        };
      }));
      
      res.json(enrichedConflicts);
    } catch (error) {
      console.error('Error fetching pending conflicts:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error fetching pending MCP conflicts', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch pending conflicts' });
    }
  });
  
  // Get conflicts for a specific regulation
  app.get('/api/mcp/conflicts/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const conflicts = await storage.getVersionConflictsForRegulation(regulationId);
      
      res.json(conflicts);
    } catch (error) {
      console.error(`Error fetching conflicts for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching MCP conflicts for regulation ${req.params.regulationId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch conflicts' });
    }
  });
  
  // Schedule a sync for a regulation
  app.post('/api/mcp/sync/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const nextSyncSchema = z.object({
        nextSync: z.coerce.date().optional(),
        syncSettings: z.object({
          frequency: z.enum(['hourly', 'daily', 'weekly', 'manual']),
          priority: z.enum(['high', 'normal', 'low']),
          includeContent: z.boolean(),
          validateOnSync: z.boolean()
        }).optional()
      });
      
      const validationResult = nextSyncSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid sync data', 
          details: validationResult.error.format() 
        });
      }
      
      const data = validationResult.data;
      
      // Ensure the regulation exists
      const regulation = await storage.getRegulation(regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: 'Regulation not found' });
      }
      
      // Get existing sync control
      const existingControl = await storage.getSyncControl(regulationId);
      
      // Set next sync time (default to 24 hours from now if not specified)
      const nextSync = data.nextSync || new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      let updatedControl;
      
      if (existingControl) {
        updatedControl = await storage.updateSyncControl(existingControl.id, {
          nextScheduledSync: nextSync,
          syncState: 'idle',
          syncSettings: data.syncSettings || existingControl.syncSettings
        });
      } else {
        updatedControl = await storage.createSyncControl({
          regulationId,
          nextScheduledSync: nextSync,
          syncState: 'idle',
          syncSettings: data.syncSettings || {
            frequency: 'daily',
            priority: 'normal',
            includeContent: true,
            validateOnSync: true
          }
        });
      }
      
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Sync scheduled for regulation ${regulationId}`, { 
        nextSync: nextSync.toISOString() 
      });
      
      res.json(updatedControl);
    } catch (error) {
      console.error(`Error scheduling sync for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error scheduling MCP sync for regulation ${req.params.regulationId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to schedule sync' });
    }
  });
  
  // Validate a regulation version
  app.post('/api/mcp/validate/:versionId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const versionId = parseInt(req.params.versionId, 10);
      
      if (isNaN(versionId)) {
        return res.status(400).json({ error: 'Invalid version ID' });
      }
      
      const version = await storage.getRegulationVersion(versionId);
      
      if (!version) {
        return res.status(404).json({ error: 'Version not found' });
      }
      
      // Use system user ID (1) for validation
      const validationResults = await storage.validateRegulationVersion(versionId, 1);
      
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Validation completed for version ${versionId}`, { 
        passedCount: validationResults.filter(r => r.status === 'passed').length,
        failedCount: validationResults.filter(r => r.status === 'failed').length
      });
      
      res.json(validationResults);
    } catch (error) {
      console.error(`Error validating version ${req.params.versionId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error validating MCP version ${req.params.versionId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to validate version' });
    }
  });
  
  // Get validation status for a version
  app.get('/api/mcp/validate/:versionId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const versionId = parseInt(req.params.versionId, 10);
      
      if (isNaN(versionId)) {
        return res.status(400).json({ error: 'Invalid version ID' });
      }
      
      const version = await storage.getRegulationVersion(versionId);
      
      if (!version) {
        return res.status(404).json({ error: 'Version not found' });
      }
      
      const validationResults = await storage.getValidationStatus(version.regulationId, versionId);
      
      res.json(validationResults);
    } catch (error) {
      console.error(`Error fetching validation status for version ${req.params.versionId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching MCP validation status for version ${req.params.versionId}`, { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch validation status' });
    }
  });
  
}