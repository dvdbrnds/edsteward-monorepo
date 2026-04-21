import express, { type Request, Response } from "express";
import { getDatabaseStorage, getTenantDb } from "./services/database";
import { sql, eq, and } from "drizzle-orm";
import { regulations, complianceTasks, roleAssignments, circuitInterpretations, circuitSplits } from "@shared/schema";
import { syslog, LogLevel, LogFacility } from './services/syslog';
import { z } from "zod";
import { ValidationLevel } from "@shared/schema";
import { normalizeCategory } from './services/category-normalizer';

/**
 * Sets up the MCP integration API routes
 * This API allows communication between the MCP Orchestrator and the local client
 * @param app Express application
 */
/**
 * Merge engine-provided action flags with existing actions, preserving completion state.
 * New enabled/required flags come from the engine; status/completedBy/completedAt are kept.
 */
function mergeActionsWithExisting(
  existingActions: any[] | null,
  engineActions: Array<{ type: string; enabled: boolean; required: boolean; status: string; dueDate?: string }>
): any[] {
  if (!existingActions || !Array.isArray(existingActions)) return engineActions;
  
  return engineActions.map(engineAction => {
    const existing = existingActions.find((a: any) => a.type === engineAction.type);
    if (existing) {
      return {
        ...existing,
        enabled: engineAction.enabled,
        required: engineAction.required,
        dueDate: engineAction.dueDate || existing.dueDate,
      };
    }
    return engineAction;
  });
}

export function setupMCPIntegrationApi(app: express.Application) {
  // Helper: Get tenant-aware storage and db from request
  // CRITICAL: All MCP routes must use these instead of global imports
  const getStorage = (req: Request) => getDatabaseStorage(req.tenantId);
  const getDb = (req: Request) => getTenantDb(req.tenantId);

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
      const storage = getStorage(req);
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
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error fetching MCP sync statuses", { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch sync statuses' });
    }
  });
  
  // Get sync status for a specific regulation
  app.get('/api/mcp/sync-status/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
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
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching MCP sync status for regulation ${req.params.regulationId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch sync status' });
    }
  });
  
  // Get latest version for a regulation
  app.get('/api/mcp/versions/:regulationId/latest', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
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
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching latest MCP version for regulation ${req.params.regulationId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch latest version' });
    }
  });
  
  // Get all versions for a regulation
  app.get('/api/mcp/versions/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const versions = await storage.getRegulationVersions(regulationId);
      
      res.json(versions);
    } catch (error) {
      console.error(`Error fetching versions for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching MCP versions for regulation ${req.params.regulationId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch versions' });
    }
  });
  
  // Create a new version for a regulation (used when MCP pushes updates)
  app.post('/api/mcp/versions/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
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
        createdBy: 1,
      } as any);
      
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
      } as any);
      
      res.status(201).json(newVersion);
    } catch (error) {
      console.error(`Error creating version for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error creating MCP version for regulation ${req.params.regulationId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to create version' });
    }
  });
  
  // Register a version conflict for a regulation
  app.post('/api/mcp/conflicts/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
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
      } as any);
      
      res.status(201).json(conflict);
    } catch (error) {
      console.error(`Error registering conflict for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error registering MCP conflict for regulation ${req.params.regulationId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to register conflict' });
    }
  });
  
  // Get all pending conflicts
  app.get('/api/mcp/conflicts/pending', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
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
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error fetching pending MCP conflicts', { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch pending conflicts' });
    }
  });
  
  // Get conflicts for a specific regulation
  app.get('/api/mcp/conflicts/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
      const regulationId = parseInt(req.params.regulationId, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const conflicts = await storage.getVersionConflictsForRegulation(regulationId);
      
      res.json(conflicts);
    } catch (error) {
      console.error(`Error fetching conflicts for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching MCP conflicts for regulation ${req.params.regulationId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch conflicts' });
    }
  });
  
  // Schedule a sync for a regulation
  app.post('/api/mcp/sync/:regulationId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
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
      } as any);
      
      res.json(updatedControl);
    } catch (error) {
      console.error(`Error scheduling sync for regulation ${req.params.regulationId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error scheduling MCP sync for regulation ${req.params.regulationId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to schedule sync' });
    }
  });
  
  // Validate a regulation version
  app.post('/api/mcp/validate/:versionId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
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
      } as any);
      
      res.json(validationResults);
    } catch (error) {
      console.error(`Error validating version ${req.params.versionId}:`, error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error validating MCP version ${req.params.versionId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to validate version' });
    }
  });
  
  // Get validation status for a version
  app.get('/api/mcp/validate/:versionId', authenticateMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
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
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error fetching MCP validation status for version ${req.params.versionId}`, { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch validation status' });
    }
  });

  // =====================================================
  // NEW REGULATION CREATION ENDPOINT FOR MCP ENGINE
  // =====================================================
  
  /**
   * Canonical MCP compliance task schema — 21 fields
   * Unified across all endpoints (Feb 2026 schema alignment)
   */
  const mcpComplianceTaskSchema = z.object({
    tempId: z.string().optional(),
    parentTempId: z.string().optional().nullable(),
    taskId: z.string().optional(),                    // Stable ID e.g. "002-001"
    title: z.string(),
    description: z.string().optional(),
    instructions: z.string().optional(),              // Step-by-step guidance
    category: z.string().optional(),                  // Grouping (Reporting, Training, Policy)
    assignedRole: z.string().optional(),
    statutoryRole: z.string().optional(),             // Legal role e.g. "Title IX Coordinator"
    statutoryCitation: z.string().optional(),          // Legal citation e.g. "34 CFR 106.8"
    requirementType: z.enum(['requirement', 'best_practice']).optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    dueDate: z.string().optional(),
    recurringSchedule: z.string().optional(),          // "annual", "quarterly", etc.
    reminderDays: z.number().optional(),
    evidenceRequired: z.boolean().optional(),
    evidenceType: z.string().optional(),
    evidenceInstructions: z.string().optional(),
    isConfidential: z.boolean().optional(),
    confidentialDataTypes: z.array(z.string()).optional().nullable(),
    estimatedEffort: z.string().optional(),
    deliverable: z.string().optional(),                // Expected output
    deliverableTemplateUrl: z.string().optional(),     // Template download link
    sortOrder: z.number().optional(),
  });

  /**
   * Canonical MCP Executive Order schema — 22 fields
   * Unified across all endpoints (Feb 2026 schema alignment)
   */
  const mcpExecutiveOrderSchema = z.object({
    eoNumber: z.string(),
    title: z.string(),
    signedDate: z.string(),
    publishedDate: z.string().optional(),
    status: z.enum(['active', 'enjoined', 'revoked', 'superseded']).optional(),
    president: z.string().optional(),
    term: z.string().optional(),
    summary: z.string().optional(),
    fullTextUrl: z.string().optional(),
    pdfUrl: z.string().optional(),
    federalRegisterCitation: z.string().optional(),
    topics: z.array(z.string()).optional(),
    impactType: z.enum(['modifies', 'reinforces', 'conflicts', 'supersedes']),
    impactSeverity: z.enum(['critical', 'high', 'medium', 'low']),
    impactSummary: z.string().optional(),
    affectedSections: z.array(z.string()).optional(),
    confidenceScore: z.number().optional(),
    assessmentDate: z.string().optional(),
    enjoinedDate: z.string().optional(),
    enjoinedBy: z.string().optional(),
    revokedDate: z.string().optional(),
    revokedBy: z.string().optional(),
  });

  /**
   * Schema for creating/syncing a regulation with compliance tasks and EOs
   * FULL 48-field payload — expanded Feb 2026 for endpoint parity
   */
  const createRegulationWithTasksSchema = z.object({
    // Required fields
    name: z.string().min(1, "Regulation name is required"),
    statute: z.string().min(1, "Statute reference is required"),
    category: z.string().min(1, "Category is required"),
    topic: z.string().min(1, "Topic is required"),
    
    // Universal identifier (REG-001 style)
    regKey: z.string().optional(),
    mcpRegKey: z.string().optional(), // Alias for regKey
    
    // Optional regulation fields
    itemId: z.string().optional(),
    jurisdictionSource: z.string().default("federal"),
    summary: z.string().optional(),
    requirements: z.union([z.string(), z.array(z.string())]).optional(),
    regulationText: z.string().optional(),
    applicableInstitutions: z.array(z.string()).optional(),
    dro: z.string().optional(),
    
    // Dates
    effectiveDate: z.string().optional(),
    originationDate: z.string().optional(),
    nextReviewDate: z.string().optional(),
    
    // Content fields (expanded Feb 2026)
    statuteIds: z.array(z.string()).optional(),
    publicLaw: z.string().optional(),
    purpose: z.string().optional(),
    scope: z.string().optional(),
    submissionGuidelines: z.string().optional(),
    complianceNotes: z.string().optional(),
    verificationMethod: z.string().optional(),
    reportingFrequency: z.string().optional(),
    reportingRequirements: z.any().optional(),
    
    // Source and reference information
    sources: z.array(z.object({
      type: z.string().optional(),
      name: z.string().optional(),
      url: z.string().optional(),
      citation: z.string().optional(),
      lastChecked: z.string().optional(),
    })).optional(),
    sections: z.array(z.object({
      type: z.string().optional(),
      value: z.string().optional(),
    })).optional(),
    relatedRegulations: z.array(z.object({
      regKey: z.string().optional(),
      relationship: z.string().optional(),
    })).optional(),
    applicableForms: z.array(z.string()).optional(),
    
    // Agency information (camelCase canonical)
    agencyName: z.string().optional(),
    agencyUrl: z.string().optional(),
    agencyContact: z.string().optional(),
    agencyDepartment: z.string().optional(),
    enforcementAgency: z.string().optional(),
    // snake_case backward compat
    agency_name: z.string().optional(),
    agency_url: z.string().optional(),
    agency_contact: z.string().optional(),
    agency_department: z.string().optional(),
    
    // URLs
    regulationUrl: z.string().optional(),
    requirementsUrl: z.string().optional(),
    submissionGuideUrl: z.string().optional(),
    formsUrl: z.string().optional(),
    sourceUrl: z.string().optional(),
    
    // Risk & validation
    riskScore: z.number().optional(),
    riskLevel: z.enum(['CRITICAL', 'SEVERE', 'HIGH', 'MODERATE', 'LOW']).optional(),
    riskAssessment: z.object({
      score: z.number().optional(),
      level: z.string().optional(),
      factors: z.array(z.any()).optional(),
      enforcementTrend: z.string().optional(),
    }).passthrough().optional(),
    lovvLevel: z.enum(['A', 'B', 'C', 'D']).optional(),
    lastValidated: z.string().optional(),
    version: z.number().optional(),
    versionHash: z.string().optional(),
    stateCode: z.string().max(2).optional(),
    countryCode: z.string().max(2).optional(),
    
    // Filing deadlines
    filingDeadlines: z.array(z.object({
      type: z.string(),
      date: z.string(),
      frequency: z.string().optional(),
      description: z.string().optional(),
    })).optional(),
    
    // Compliance tasks — canonical 21-field schema
    complianceTasks: z.array(mcpComplianceTaskSchema).optional(),
    
    // Executive Orders — canonical 22-field schema (NEW Feb 2026)
    executiveOrders: z.array(mcpExecutiveOrderSchema).optional(),
    
    // Task sync behavior flags
    taskSyncMode: z.enum(['replace', 'merge']).optional(),
    preserveExistingTasks: z.boolean().optional(), // legacy; taskSyncMode takes precedence
    
    // Topic mappings
    topics: z.array(z.object({
      topic: z.string().optional(),
      name: z.string().optional(),
      topicId: z.number().optional(),
      topic_id: z.number().optional(),
      department: z.string().optional(),
      responsibleRole: z.string().optional(),
      responsible_role: z.string().optional(),
    })).optional(),
    
    // Metadata
    metadata: z.object({
      source: z.string().optional(),
      mcpVersion: z.string().optional(),
      createdBy: z.string().optional(),
      audit: z.any().optional(),
    }).passthrough().optional(),
  });

  /**
   * Unified MCP Auth middleware for Create/Sync endpoints
   * Accepts EITHER:
   *   1. X-MCP-API-Key header (preferred — matches orchestrator)
   *   2. Basic Auth with MCP_ENGINE_USERNAME/PASSWORD from env (backward compat)
   *   3. Legacy hardcoded Basic Auth (deprecated — will be removed)
   * ALLOWS BYPASS for localhost requests
   */
  function basicAuthMCP(req: Request, res: Response, next: Function) {
    // Localhost bypass only in development
    if (process.env.NODE_ENV !== 'production') {
      const host = req.headers.host || '';
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return next();
      }
    }

    // Method 1: X-MCP-API-Key header (preferred)
    const apiKey = req.headers['x-mcp-api-key'];
    if (apiKey && apiKey === process.env.MCP_API_KEY) {
      return next();
    }

    // Method 2 & 3: Basic Auth
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Provide X-MCP-API-Key header or Basic Auth credentials'
      });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    // Check env-configured credentials first
    const mcpUser = process.env.MCP_ENGINE_USERNAME || 'mcp-engine';
    const mcpPass = process.env.MCP_ENGINE_PASSWORD;
    if (mcpPass && username === mcpUser && password === mcpPass) {
      return next();
    }

    // Legacy fallback using env vars
    const engineUser = process.env.MCP_ENGINE_USERNAME;
    const enginePass = process.env.MCP_ENGINE_PASSWORD;
    if (engineUser && enginePass && username === engineUser && password === enginePass) {
      return next();
    }

    return res.status(401).json({ 
      error: 'Invalid credentials',
      message: 'Provide valid X-MCP-API-Key header or Basic Auth credentials'
    });
  }

  /**
   * POST /api/mcp/regulations/create
   * 
   * Creates a NEW regulation with optional compliance tasks in a single atomic operation.
   * This is the correct endpoint for MCP Engine to use when adding regulations
   * that don't already exist in EdSteward.
   * 
   * Authentication: Basic Auth (MCP_ENGINE_USERNAME:MCP_ENGINE_PASSWORD) or X-MCP-API-Key header
   * 
   * Example payload:
   * {
   *   "name": "General Data Protection Regulation (GDPR)",
   *   "statute": "EU Regulation 2016/679",
   *   "category": "Information Technology",
   *   "topic": "Data Privacy",
   *   "jurisdictionSource": "international",
   *   "summary": "The GDPR is a comprehensive data protection law...",
   *   "requirements": "• Appoint a Data Protection Officer...",
   *   "complianceTasks": [
   *     {
   *       "tempId": "task-1",
   *       "title": "Appoint Data Protection Officer",
   *       "description": "Designate a DPO to oversee GDPR compliance",
   *       "assignedRole": "IT Director",
   *       "priority": "high",
   *       "evidenceRequired": true,
   *       "evidenceType": "document"
   *     }
   *   ]
   * }
   */
  app.post('/api/mcp/regulations/create', basicAuthMCP, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log(`\n========================================`);
    console.log(`📥 [${timestamp}] MCP CREATE NEW REGULATION REQUEST`);
    console.log(`========================================`);
    
    try {
      const db = getDb(req);
      const storage = getStorage(req);
      // Validate the payload
      const validation = createRegulationWithTasksSchema.safeParse(req.body);
      
      if (!validation.success) {
        console.error('❌ Validation failed:', validation.error.issues);
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }
      
      const data = validation.data;
      console.log(`📋 Creating regulation: ${data.name}`);
      console.log(`   Category: ${data.category}`);
      console.log(`   Jurisdiction: ${data.jurisdictionSource}`);
      console.log(`   Tasks: ${data.complianceTasks?.length || 0}`);
      
      // Check if regulation already exists by name
      const existingRegulations = await storage.searchRegulations(data.name);
      const exactMatch = existingRegulations.find(
        r => r.name.toLowerCase() === data.name.toLowerCase()
      );
      
      if (exactMatch) {
        console.log(`⚠️ Regulation already exists with ID ${exactMatch.id}`);
        return res.status(409).json({
          success: false,
          error: 'Regulation already exists',
          existingRegulationId: exactMatch.id,
          existingRegulationName: exactMatch.name,
          message: `A regulation named "${data.name}" already exists. Use /api/regulation-updates to update it instead.`,
        });
      }
      
      // Generate itemId if not provided
      const itemId = data.itemId || `REG-${data.name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30).toUpperCase()}-${Date.now()}`;
      
      // Build actions from engine-provided regulationActions, or fall back to defaults
      const hasDeadlines = data.filingDeadlines && data.filingDeadlines.length > 0;
      const firstDeadline = hasDeadlines ? data.filingDeadlines![0] : null;
      const engineActions = (data as any).regulationActions;
      const defaultActions = [
        {
          type: 'attestation' as const,
          enabled: true,
          required: true,
          status: 'pending' as const,
        },
        {
          type: 'website_publish' as const,
          enabled: !!engineActions?.website_publish?.required,
          required: !!engineActions?.website_publish?.required,
          status: 'pending' as const,
        },
        {
          type: 'community_communication' as const,
          enabled: !!engineActions?.community_communication?.required,
          required: !!engineActions?.community_communication?.required,
          status: 'pending' as const,
        },
        {
          type: 'agency_submission' as const,
          enabled: !!engineActions?.agency_submission?.required || hasDeadlines,
          required: !!engineActions?.agency_submission?.required || hasDeadlines,
          status: 'pending' as const,
          dueDate: firstDeadline?.date || undefined,
        },
      ];
      if (engineActions) {
        console.log(`🎯 Using engine-provided actions: ${defaultActions.filter(a => a.enabled).map(a => a.type).join(', ')}`);
      }
      
      // Resolve camelCase vs snake_case agency fields
      const resolvedAgencyName = data.agencyName || data.agency_name || null;
      const resolvedAgencyUrl = data.agencyUrl || data.agency_url || null;
      const resolvedAgencyContact = data.agencyContact || data.agency_contact || null;
      const resolvedAgencyDepartment = data.agencyDepartment || data.agency_department || null;
      
      // Resolve regKey (prefer regKey, fall back to mcpRegKey)
      const resolvedRegKey = data.regKey || data.mcpRegKey || null;
      
      // Normalize requirements to string
      const requirementsStr = Array.isArray(data.requirements)
        ? data.requirements.join('\n• ')
        : data.requirements || null;
      
      // Create the regulation with ALL MCP Engine fields (expanded Feb 2026)
      console.log('💾 Inserting regulation into database...');
      const [newRegulation] = await db.insert(regulations).values({
        itemId,
        regKey: resolvedRegKey,
        name: data.name,
        topic: data.topic,
        statute: data.statute,
        statuteIds: data.statuteIds ? JSON.stringify(data.statuteIds) : null,
        category: data.category,
        jurisdictionSource: data.jurisdictionSource,
        summary: data.summary || null,
        requirements: requirementsStr,
        regulationText: data.regulationText || null,
        applicableInstitutions: data.applicableInstitutions || null,
        dro: data.dro || '',
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        originationDate: data.originationDate ? new Date(data.originationDate) : null,
        nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
        agency_name: resolvedAgencyName,
        agency_url: resolvedAgencyUrl,
        agency_contact: resolvedAgencyContact,
        agency_department: resolvedAgencyDepartment,
        regulationUrl: data.regulationUrl || null,
        requirementsUrl: data.requirementsUrl || null,
        submissionGuideUrl: data.submissionGuideUrl || null,
        formsUrl: data.formsUrl || null,
        submissionGuidelines: data.submissionGuidelines || null,
        reportingFrequency: data.reportingFrequency || null,
        filingDeadlines: data.filingDeadlines || null,
        publicLaw: data.publicLaw || null,
        purpose: data.purpose || null,
        scope: data.scope || null,
        complianceNotes: data.complianceNotes || null,
        verificationMethod: data.verificationMethod || null,
        reportingRequirements: data.reportingRequirements || null,
        sources: data.sources || null,
        sections: data.sections || null,
        relatedRegulations: data.relatedRegulations || null,
        applicableforms: data.applicableForms || null,
        sourceUrl: data.sourceUrl || null,
        riskScore: data.riskScore || null,
        riskLevel: data.riskLevel || null,
        riskAssessment: data.riskAssessment || null,
        lovvLevel: data.lovvLevel || null,
        lastValidated: data.lastValidated ? new Date(data.lastValidated) : null,
        versionHash: data.versionHash || null,
        stateCode: data.stateCode || null,
        countryCode: data.countryCode || null,
        isApplicable: true,
        isCurrent: true,
        versionNumber: data.version || 1,
        actions: defaultActions,
      } as any).returning() as any[];
      
      console.log(`✅ Regulation created with ID: ${newRegulation.id}`);
      
      // Create compliance tasks if provided
      const createdTasks: Array<{ id: number; tempId?: string; title: string }> = [];
      const taskIdMap = new Map<string, number>(); // Map tempId to actual ID
      
      if (data.complianceTasks && data.complianceTasks.length > 0) {
        console.log(`📝 Creating ${data.complianceTasks.length} compliance tasks...`);
        
        // Preload role_assignments for office field resolution
        const createRoleRows = await db.select({
          roleName: roleAssignments.roleName,
          officeName: roleAssignments.officeName,
          officeEmail: roleAssignments.officeEmail,
        }).from(roleAssignments);
        const createOfficeByRole = new Map<string, { officeName: string | null; officeEmail: string | null }>();
        for (const ra of createRoleRows) {
          createOfficeByRole.set(ra.roleName.toLowerCase(), { officeName: ra.officeName, officeEmail: ra.officeEmail });
        }
        const createResolveOffice = (assignedRole: string | null) => {
          if (assignedRole) {
            const match = createOfficeByRole.get(assignedRole.toLowerCase());
            if (match?.officeName || match?.officeEmail) return match;
          }
          return { officeName: null, officeEmail: null };
        };
        
        // parentRole cascades the parent's assignedRole to subtasks that don't have their own
        const buildTaskValues = (task: typeof data.complianceTasks[0], parentId?: number, parentRole?: string | null) => {
          const effectiveRole = task.assignedRole || parentRole || null;
          const office = createResolveOffice(effectiveRole);
          return {
            regulationId: newRegulation.id,
            parentTaskId: parentId || null,
            taskId: task.taskId || null,
            title: task.title,
            description: task.description || null,
            instructions: task.instructions || null,
            category: task.category || null,
            assignedRole: effectiveRole,
            responsibleOffice: office.officeName,
            responsibleOfficeEmail: office.officeEmail,
            statutoryRole: task.statutoryRole || null,
            statutoryCitation: task.statutoryCitation || null,
            requirementType: task.requirementType || 'requirement',
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            recurringSchedule: task.recurringSchedule || null,
            reminderDays: task.reminderDays || 30,
            priority: task.priority || 'medium',
            evidenceRequired: task.evidenceRequired || false,
            evidenceType: task.evidenceType || 'none',
            evidenceInstructions: task.evidenceInstructions || null,
            isConfidential: task.isConfidential || false,
            confidentialDataTypes: task.confidentialDataTypes || null,
            estimatedEffort: task.estimatedEffort || null,
            deliverable: task.deliverable || null,
            deliverableTemplateUrl: task.deliverableTemplateUrl || null,
            sortOrder: task.sortOrder || 0,
            status: 'pending',
            isTemplate: false,
          };
        };
        
        // Track parent roles for cascading to subtasks
        const parentRoleMap = new Map<string, string>();
        
        // First pass: create root tasks (no parent)
        const rootTasks = data.complianceTasks.filter(t => !t.parentTempId);
        for (const task of rootTasks) {
          const [newTask] = await db.insert(complianceTasks).values(
            buildTaskValues(task)
          ).returning();
          
          if (task.tempId) {
            taskIdMap.set(task.tempId, newTask.id);
            if (task.assignedRole) {
              parentRoleMap.set(task.tempId, task.assignedRole);
            }
          }
          createdTasks.push({
            id: newTask.id,
            tempId: task.tempId,
            title: task.title,
          });
        }
        
        // Second pass: create child tasks (with parent), inheriting parent's role if none specified
        const childTasks = data.complianceTasks.filter(t => t.parentTempId);
        for (const task of childTasks) {
          const parentId = taskIdMap.get(task.parentTempId!);
          if (!parentId) {
            console.warn(`⚠️ Could not find parent task with tempId: ${task.parentTempId}`);
            continue;
          }
          
          const parentRole = parentRoleMap.get(task.parentTempId!) || null;
          const [newTask] = await db.insert(complianceTasks).values(
            buildTaskValues(task, parentId, parentRole)
          ).returning();
          
          if (task.tempId) {
            taskIdMap.set(task.tempId, newTask.id);
          }
          createdTasks.push({
            id: newTask.id,
            tempId: task.tempId,
            title: task.title,
          });
        }
        
        console.log(`✅ Created ${createdTasks.length} compliance tasks`);
      }
      
      // Handle topic mappings if provided
      if ((data as any).topics && Array.isArray((data as any).topics) && (data as any).topics.length > 0) {
        console.log(`🏷️ Processing ${(data as any).topics.length} topic mappings...`);
        
        // Clear existing topic mappings for this regulation
        await db.execute(
          sql`DELETE FROM regulation_topics WHERE regulation_id = ${newRegulation.id}`
        );
        
        for (const topic of (data as any).topics) {
          await db.execute(sql`
            INSERT INTO regulation_topics (
              regulation_id, topic, topic_id, department, responsible_role
            ) VALUES (
              ${newRegulation.id},
              ${topic.topic || topic.name},
              ${topic.topicId || topic.topic_id || null},
              ${topic.department || null},
              ${topic.responsibleRole || topic.responsible_role || null}
            )
            ON CONFLICT (regulation_id, topic) DO UPDATE SET
              topic_id = EXCLUDED.topic_id,
              department = EXCLUDED.department,
              responsible_role = EXCLUDED.responsible_role
          `);
        }
        
        console.log(`✅ Created ${(data as any).topics.length} topic mappings`);
      }
      
      // Process Executive Orders if provided (Feb 2026 schema alignment)
      let createdEOs = 0;
      if (data.executiveOrders && data.executiveOrders.length > 0) {
        console.log(`⚖️ Processing ${data.executiveOrders.length} Executive Orders...`);
        
        for (const eo of data.executiveOrders) {
          try {
            // Upsert the EO record
            const topicsValue = eo.topics && Array.isArray(eo.topics) && eo.topics.length > 0
              ? '{' + eo.topics.map((t: string) => '"' + t.replace(/"/g, '\\"') + '"').join(',') + '}'
              : null;
            
            const eoResult = await db.execute(sql`
              INSERT INTO executive_orders (
                eo_number, title, signed_date, published_date, status,
                president, term, summary, full_text_url, pdf_url,
                federal_register_citation, topics,
                enjoined_date, enjoined_by, revoked_date, revoked_by
              ) VALUES (
                ${eo.eoNumber}, ${eo.title}, ${eo.signedDate},
                ${eo.publishedDate || null}, ${eo.status || 'active'},
                ${eo.president || null}, ${eo.term || null},
                ${eo.summary || null}, ${eo.fullTextUrl || null}, ${eo.pdfUrl || null},
                ${eo.federalRegisterCitation || null},
                ${topicsValue},
                ${eo.enjoinedDate || null}, ${eo.enjoinedBy || null},
                ${eo.revokedDate || null}, ${eo.revokedBy || null}
              )
              ON CONFLICT (eo_number) DO UPDATE SET
                title = EXCLUDED.title,
                status = EXCLUDED.status,
                summary = EXCLUDED.summary,
                full_text_url = EXCLUDED.full_text_url,
                pdf_url = EXCLUDED.pdf_url,
                federal_register_citation = EXCLUDED.federal_register_citation,
                topics = EXCLUDED.topics,
                enjoined_date = EXCLUDED.enjoined_date,
                enjoined_by = EXCLUDED.enjoined_by,
                revoked_date = EXCLUDED.revoked_date,
                revoked_by = EXCLUDED.revoked_by,
                updated_at = NOW()
              RETURNING id
            `);
            
            // db.execute returns QueryResult — extract the id from first row
            const eoRows = (eoResult as any)?.rows || [];
            const eoId = eoRows.length > 0 ? eoRows[0]?.id : null;
            if (eoId) {
              // Upsert the impact record
              await db.execute(sql`
                INSERT INTO eo_regulation_impacts (
                  eo_id, regulation_id, impact_type, impact_severity,
                  impact_summary, affected_sections, confidence_score,
                  assessed_by, assessment_date
                ) VALUES (
                  ${eoId}, ${newRegulation.id}, ${eo.impactType}, ${eo.impactSeverity},
                  ${eo.impactSummary || null},
                  ${eo.affectedSections ? JSON.stringify(eo.affectedSections) : null},
                  ${eo.confidenceScore ? String(eo.confidenceScore) : null},
                  ${'EdSteward AI'}, ${eo.assessmentDate || new Date().toISOString().split('T')[0]}
                )
                ON CONFLICT (eo_id, regulation_id) DO UPDATE SET
                  impact_type = EXCLUDED.impact_type,
                  impact_severity = EXCLUDED.impact_severity,
                  impact_summary = EXCLUDED.impact_summary,
                  affected_sections = EXCLUDED.affected_sections,
                  confidence_score = EXCLUDED.confidence_score,
                  updated_at = NOW()
              `);
              createdEOs++;
            }
          } catch (eoError) {
            console.warn(`⚠️ Error processing EO ${eo.eoNumber}:`, eoError);
          }
        }
        
        console.log(`✅ Processed ${createdEOs} Executive Orders`);
      }
      
      // Log to syslog
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `New regulation created via MCP: ${data.name}`, {
        regulationId: newRegulation.id,
        taskCount: createdTasks.length,
        eoCount: createdEOs,
      } as any);
      
      // Success response
      const response = {
        success: true,
        message: `Successfully created regulation "${data.name}" with ${createdTasks.length} compliance tasks and ${createdEOs} executive orders`,
        regulation: {
          id: newRegulation.id,
          itemId: newRegulation.itemId,
          regKey: resolvedRegKey,
          name: newRegulation.name,
          category: newRegulation.category,
          jurisdictionSource: newRegulation.jurisdictionSource,
        },
        tasks: createdTasks,
        taskIdMapping: Object.fromEntries(taskIdMap),
        executiveOrders: createdEOs,
        timestamp,
      };
      
      console.log(`\n✅ SUCCESS: Created regulation ID ${newRegulation.id} with ${createdTasks.length} tasks`);
      console.log(`========================================\n`);
      
      res.status(201).json(response);
      
    } catch (error) {
      console.error('❌ Error creating regulation:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error creating regulation via MCP', { 
        error: String(error) 
      } as any);
      
      res.status(500).json({
        success: false,
        error: 'Failed to create regulation',
        details: error instanceof Error ? error.message : String(error),
        timestamp,
      });
    }
  });

  /**
   * POST /api/mcp/regulations/sync
   * 
   * UPSERT endpoint - Creates a new regulation OR updates existing one
   * Matches by regulationId (item_id in EdSteward)
   * 
   * This is the recommended endpoint for MCP Engine to sync regulations
   */
  app.post('/api/mcp/regulations/sync', basicAuthMCP, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    
    console.log(`\n========================================`);
    console.log(`📥 MCP SYNC REQUEST at ${timestamp}`);
    console.log(`========================================`);
    
    try {
      const db = getDb(req);
      const _storage = getStorage(req);
      const data = req.body;
      
      // Validate required fields
      if (!data.name || !data.statute || !data.category || !data.topic) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, statute, category, topic',
          timestamp,
        });
      }
      
      // Extract universal reg_key and risk data from payload
      // Support both 'mcpRegKey' (MCP Engine sends this) and 'regKey' (legacy)
      const regKey = data.mcpRegKey || data.regKey; // Universal key like REG-001
      const riskScore = data.riskScore; // 1-100 score
      const riskLevel = data.riskLevel; // CRITICAL, SEVERE, HIGH, MODERATE, LOW
      
      // regulationId from MCP Engine is the EdSteward database primary key (id)
      // itemId is the slug-style identifier (e.g., 'title-ix', 'REG1987')
      const regulationDbId = typeof data.regulationId === 'number' ? data.regulationId : null;
      const itemId = data.itemId || 
        `REG-${data.name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30).toUpperCase()}-${Date.now()}`;
      
      console.log(`🔍 Looking for existing regulation...`);
      if (regKey) console.log(`   reg_key: ${regKey}`);
      if (regulationDbId) console.log(`   regulationId (DB pk): ${regulationDbId}`);
      console.log(`   item_id: ${itemId}`);
      
      // Normalize category (smart mapping to canonical categories)
      const categoryResult = await normalizeCategory(data.category, { 
        source: data.jurisdictionSource || 'mcp-engine',
        autoCreate: true 
      });
      
      if (categoryResult.isNewMapping) {
        console.log(`🏷️ Auto-mapped category: "${data.category}" → "${categoryResult.canonicalName}" (${(categoryResult.confidence * 100).toFixed(0)}% confidence)`);
      }
      
      // Check if regulation exists - try reg_key first, then DB primary key, then item_id
      let existingReg: any[] = [];
      
      // 1. Try reg_key (universal key like REG-002) - most reliable match
      if (regKey) {
        existingReg = await db.select()
          .from(regulations)
          .where(eq(regulations.regKey, regKey))
          .limit(1);
        if (existingReg.length > 0) {
          console.log(`   ✅ Matched by reg_key: ${regKey} → id ${existingReg[0].id}`);
        }
      }
      
      // 2. Try regulationId as database primary key (id column)
      if ((!existingReg || existingReg.length === 0) && regulationDbId) {
        existingReg = await db.select()
          .from(regulations)
          .where(eq(regulations.id, regulationDbId))
          .limit(1);
        if (existingReg.length > 0) {
          console.log(`   ✅ Matched by DB id: ${regulationDbId}`);
        }
      }
      
      // 3. Try item_id (slug-style identifier) as last resort
      if (!existingReg || existingReg.length === 0) {
        existingReg = await db.select()
          .from(regulations)
          .where(eq(regulations.itemId, itemId))
          .limit(1);
        if (existingReg.length > 0) {
          console.log(`   ✅ Matched by item_id: ${itemId} → id ${existingReg[0].id}`);
        }
      }
      
      if (!existingReg || existingReg.length === 0) {
        console.log(`   ⚠️ No existing record found — will create new`);
        existingReg = [];
      }
      
      const isUpdate = existingReg.length > 0;
      let regulationId: number;
      let regulationRecord: any;
      
      // Build actions from engine-provided regulationActions, or fall back to defaults
      const hasDeadlines = data.filingDeadlines && data.filingDeadlines.length > 0;
      const firstDeadline = hasDeadlines ? data.filingDeadlines[0] : null;
      const syncEngineActions = data.regulationActions;
      const defaultActions = [
        { type: 'attestation' as const, enabled: true, required: true, status: 'pending' as const },
        { type: 'website_publish' as const, enabled: !!syncEngineActions?.website_publish?.required, required: !!syncEngineActions?.website_publish?.required, status: 'pending' as const },
        { type: 'community_communication' as const, enabled: !!syncEngineActions?.community_communication?.required, required: !!syncEngineActions?.community_communication?.required, status: 'pending' as const },
        { type: 'agency_submission' as const, enabled: !!syncEngineActions?.agency_submission?.required || hasDeadlines, required: !!syncEngineActions?.agency_submission?.required || hasDeadlines, status: 'pending' as const, dueDate: firstDeadline?.date },
      ];
      if (syncEngineActions) {
        console.log(`🎯 Sync: using engine-provided actions: ${defaultActions.filter(a => a.enabled).map(a => a.type).join(', ')}`);
      }
      
      if (isUpdate) {
        // UPDATE existing regulation
        console.log(`📝 Updating existing regulation ID: ${existingReg[0].id}`);
        
        // Resolve camelCase vs snake_case field names
        const resolvedAgencyName = data.agencyName || data.agency_name;
        const resolvedAgencyUrl = data.agencyUrl || data.agency_url;
        const resolvedAgencyContact = data.agencyContact || data.agency_contact;
        const resolvedAgencyDepartment = data.agencyDepartment || data.agency_department;
        const requirementsStr = Array.isArray(data.requirements)
          ? data.requirements.join('\n• ')
          : data.requirements || null;
        
        const [updated] = await db.update(regulations)
          .set({
            name: data.name,
            topic: data.topic,
            statute: data.statute,
            statuteIds: data.statuteIds ? JSON.stringify(data.statuteIds) : existingReg[0].statuteIds,
            category: categoryResult.canonicalName || data.category,
            originalCategory: categoryResult.originalCategory,
            canonicalCategoryId: categoryResult.canonicalId,
            jurisdictionSource: data.jurisdictionSource || 'federal',
            summary: data.summary || null,
            requirements: requirementsStr,
            regulationText: data.regulationText || null,
            applicableInstitutions: data.applicableInstitutions || null,
            dro: data.dro || existingReg[0].dro || '',
            effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : existingReg[0].effectiveDate,
            originationDate: data.originationDate ? new Date(data.originationDate) : existingReg[0].originationDate,
            nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : existingReg[0].nextReviewDate,
            // Agency info (camelCase with snake_case fallback)
            agency_name: resolvedAgencyName || existingReg[0].agency_name,
            agency_url: resolvedAgencyUrl || existingReg[0].agency_url,
            agency_contact: resolvedAgencyContact || existingReg[0].agency_contact,
            agency_department: resolvedAgencyDepartment || existingReg[0].agency_department,
            // URLs
            regulationUrl: data.regulationUrl || existingReg[0].regulationUrl,
            requirementsUrl: data.requirementsUrl || existingReg[0].requirementsUrl,
            submissionGuideUrl: data.submissionGuideUrl || existingReg[0].submissionGuideUrl,
            formsUrl: data.formsUrl || existingReg[0].formsUrl,
            submissionGuidelines: data.submissionGuidelines || existingReg[0].submissionGuidelines,
            reportingFrequency: data.reportingFrequency || existingReg[0].reportingFrequency,
            filingDeadlines: data.filingDeadlines || existingReg[0].filingDeadlines,
            // New content fields (Feb 2026)
            publicLaw: data.publicLaw || existingReg[0].publicLaw,
            purpose: data.purpose || existingReg[0].purpose,
            scope: data.scope || existingReg[0].scope,
            complianceNotes: data.complianceNotes || existingReg[0].complianceNotes,
            verificationMethod: data.verificationMethod || existingReg[0].verificationMethod,
            reportingRequirements: data.reportingRequirements || existingReg[0].reportingRequirements,
            sources: data.sources || existingReg[0].sources,
            sections: data.sections || existingReg[0].sections,
            relatedRegulations: data.relatedRegulations || existingReg[0].relatedRegulations,
            applicableforms: data.applicableForms || existingReg[0].applicableforms,
            sourceUrl: data.sourceUrl || existingReg[0].sourceUrl,
            // Risk & validation
            riskScore: riskScore || existingReg[0].riskScore,
            riskLevel: riskLevel || existingReg[0].riskLevel,
            riskAssessment: data.riskAssessment || existingReg[0].riskAssessment,
            // Bespoke / enriched fields (Mar 2026)
            bespokeSource: data.bespokeSource ?? existingReg[0].bespokeSource ?? false,
            penalties: data.penalties || existingReg[0].penalties,
            responsibleRoles: data.responsibleRoles || existingReg[0].responsibleRoles,
            lovvLevel: data.lovvLevel || existingReg[0].lovvLevel,
            lastValidated: data.lastValidated ? new Date(data.lastValidated) : new Date(),
            versionHash: data.versionHash || null,
            stateCode: data.stateCode || existingReg[0].stateCode,
            countryCode: data.countryCode || existingReg[0].countryCode,
            // Universal reg_key
            regKey: regKey || existingReg[0].regKey,
            lastUpdated: new Date(),
            // Use engine-provided actions to update enabled/required flags, but preserve completion state
            actions: syncEngineActions
              ? mergeActionsWithExisting(existingReg[0].actions, defaultActions)
              : (existingReg[0].actions || defaultActions),
          })
          .where(eq(regulations.id, existingReg[0].id))
          .returning();
        
        regulationId = updated.id;
        regulationRecord = updated;
        
      } else {
        // CREATE new regulation
        console.log(`✨ Creating new regulation with item_id: ${itemId}`);
        
        // Resolve camelCase vs snake_case field names for create
        const resolvedAgencyNameC = data.agencyName || data.agency_name;
        const resolvedAgencyUrlC = data.agencyUrl || data.agency_url;
        const resolvedAgencyContactC = data.agencyContact || data.agency_contact;
        const resolvedAgencyDepartmentC = data.agencyDepartment || data.agency_department;
        const requirementsStrC = Array.isArray(data.requirements)
          ? data.requirements.join('\n• ')
          : data.requirements || null;
        
        const [created] = await db.insert(regulations).values({
          itemId,
          regKey: regKey || null,
          name: data.name,
          topic: data.topic,
          statute: data.statute,
          statuteIds: data.statuteIds ? JSON.stringify(data.statuteIds) : null,
          category: categoryResult.canonicalName || data.category,
          originalCategory: categoryResult.originalCategory,
          canonicalCategoryId: categoryResult.canonicalId,
          jurisdictionSource: data.jurisdictionSource || 'federal',
          summary: data.summary || null,
          requirements: requirementsStrC,
          regulationText: data.regulationText || null,
          applicableInstitutions: data.applicableInstitutions || null,
          dro: data.dro || '',
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
          originationDate: data.originationDate ? new Date(data.originationDate) : null,
          nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
          agency_name: resolvedAgencyNameC || null,
          agency_url: resolvedAgencyUrlC || null,
          agency_contact: resolvedAgencyContactC || null,
          agency_department: resolvedAgencyDepartmentC || null,
          regulationUrl: data.regulationUrl || null,
          requirementsUrl: data.requirementsUrl || null,
          submissionGuideUrl: data.submissionGuideUrl || null,
          formsUrl: data.formsUrl || null,
          submissionGuidelines: data.submissionGuidelines || null,
          reportingFrequency: data.reportingFrequency || null,
          filingDeadlines: data.filingDeadlines || null,
          publicLaw: data.publicLaw || null,
          purpose: data.purpose || null,
          scope: data.scope || null,
          complianceNotes: data.complianceNotes || null,
          verificationMethod: data.verificationMethod || null,
          reportingRequirements: data.reportingRequirements || null,
          sources: data.sources || null,
          sections: data.sections || null,
          relatedRegulations: data.relatedRegulations || null,
          applicableforms: data.applicableForms || null,
          sourceUrl: data.sourceUrl || null,
          riskScore: riskScore || null,
          riskLevel: riskLevel || null,
          riskAssessment: data.riskAssessment || null,
          bespokeSource: data.bespokeSource ?? false,
          penalties: data.penalties || null,
          responsibleRoles: data.responsibleRoles || null,
          lovvLevel: data.lovvLevel || null,
          lastValidated: data.lastValidated ? new Date(data.lastValidated) : null,
          versionHash: data.versionHash || null,
          stateCode: data.stateCode || null,
          countryCode: data.countryCode || null,
          isApplicable: true,
          isCurrent: true,
          versionNumber: data.version || 1,
          actions: defaultActions,
        }).returning() as any[];
        
        regulationId = created.id;
        regulationRecord = created;
      }
      
      // Handle compliance tasks
      // REPLACE mode: deletes all existing tasks, inserts only the incoming set
      // MERGE mode: keeps existing tasks, adds/updates new ones (dedup by taskId then title)
      //
      // Priority: explicit taskSyncMode > bespokeSource > preserveExistingTasks > default (merge)
      const createdTasks: Array<{ id: number; tempId?: string; title: string }> = [];
      const taskIdMap = new Map<string, number>();

      let preserveTasks: boolean;
      if (data.taskSyncMode === 'replace') {
        preserveTasks = false;
      } else if (data.taskSyncMode === 'merge') {
        preserveTasks = true;
      } else if (data.bespokeSource) {
        // Bespoke payloads are hand-audited and authoritative — replace by default
        preserveTasks = false;
      } else if (data.preserveExistingTasks !== undefined) {
        preserveTasks = data.preserveExistingTasks !== false;
      } else {
        preserveTasks = true; // safe default
      }
      
      if (data.complianceTasks && data.complianceTasks.length > 0) {
        const mode = preserveTasks ? 'MERGE' : 'REPLACE';
        console.log(`📝 Processing ${data.complianceTasks.length} compliance tasks (${mode} mode)...`);
        
        // Debug: Log hierarchy analysis
        const rootTasks = data.complianceTasks.filter((t: any) => !t.parentTempId);
        const childTasks = data.complianceTasks.filter((t: any) => t.parentTempId);
        console.log(`   📊 Hierarchy: ${rootTasks.length} parents, ${childTasks.length} children`);
        
        if (childTasks.length > 0) {
          console.log(`   🔗 Sample child: tempId=${childTasks[0].tempId}, parentTempId=${childTasks[0].parentTempId}`);
        }
        
        if (!preserveTasks) {
          // REPLACE mode: Delete existing tasks for this regulation
          // Must clear dependent rows first (attestation tokens, evidence, activity logs)
          const existingTaskIds = await db.execute(sql`
            SELECT id FROM compliance_tasks WHERE regulation_id = ${regulationId}
          `);
          if (existingTaskIds.rows.length > 0) {
            const taskIds = existingTaskIds.rows.map((r: any) => r.id);
            // Build a proper PostgreSQL int array literal for ANY()
            const pgArray = `{${taskIds.join(',')}}`;
            await db.execute(sql`DELETE FROM task_attestation_tokens WHERE task_id = ANY(${pgArray}::int[])`);
            await db.execute(sql`DELETE FROM task_evidence WHERE task_id = ANY(${pgArray}::int[])`);
            await db.execute(sql`DELETE FROM task_activity WHERE task_id = ANY(${pgArray}::int[])`);
            console.log(`   🧹 Cleared dependents for ${taskIds.length} existing tasks`);
          }
          await db.delete(complianceTasks).where(eq(complianceTasks.regulationId, regulationId));
          console.log(`   🗑️  Deleted existing tasks for regulation ${regulationId}`);
        } else {
          console.log(`   🔒 MERGE mode with deduplication`);
        }
        
        // Load existing tasks for dedup in MERGE mode
        // Index by taskId (stable ID from MCP) and by title (fallback)
        const existingByTaskId = new Map<string, any>();
        const existingByTitle = new Map<string, any>();
        if (preserveTasks) {
          const existing = await db.execute(sql`
            SELECT id, task_id, title, status, attestation_status
            FROM compliance_tasks WHERE regulation_id = ${regulationId}
          `);
          for (const row of existing.rows as any[]) {
            if (row.task_id) existingByTaskId.set(row.task_id, row);
            existingByTitle.set(row.title, row);
          }
          console.log(`   📋 Found ${existing.rows.length} existing tasks (${existingByTaskId.size} with taskId, ${existingByTitle.size} unique titles)`);
        }
        
        // Helper: find existing task match (by taskId first, then title)
        const findExisting = (task: any): any | null => {
          if (task.taskId && existingByTaskId.has(task.taskId)) {
            return existingByTaskId.get(task.taskId);
          }
          if (existingByTitle.has(task.title)) {
            return existingByTitle.get(task.title);
          }
          return null;
        };
        
        // Helper: check if task should be skipped (completed/attested tasks are preserved)
        const shouldSkipUpdate = (existing: any): boolean => {
          return existing.status === 'completed' || existing.attestation_status === 'attested';
        };
        
        // Resolve evidenceRequired: payload may send a string description instead of boolean
        const resolveEvidence = (task: any) => {
          if (typeof task.evidenceRequired === 'string' && task.evidenceRequired) {
            return { flag: true, instructions: task.evidenceRequired };
          }
          return {
            flag: !!task.evidenceRequired,
            instructions: task.evidenceInstructions || null,
          };
        };

        // Resolve deadline object: { type, date, description } → dueDate + metadata
        const resolveDueDate = (task: any): Date | null => {
          if (task.dueDate) return new Date(task.dueDate);
          if (task.deadline?.date) return new Date(task.deadline.date);
          return null;
        };

        // Preload role_assignments for office field resolution
        const roleAssignmentRows = await db.select({
          roleName: roleAssignments.roleName,
          officeName: roleAssignments.officeName,
          officeEmail: roleAssignments.officeEmail,
        }).from(roleAssignments);
        const officeByRole = new Map<string, { officeName: string | null; officeEmail: string | null }>();
        for (const ra of roleAssignmentRows) {
          officeByRole.set(ra.roleName.toLowerCase(), { officeName: ra.officeName, officeEmail: ra.officeEmail });
        }
        const regOffice = regulationRecord?.responsibleOffice || null;
        const regOfficeEmail = regulationRecord?.responsibleOfficeEmail || null;

        const resolveOffice = (assignedRole: string | null) => {
          if (assignedRole) {
            const match = officeByRole.get(assignedRole.toLowerCase());
            if (match?.officeName || match?.officeEmail) return match;
          }
          return { officeName: regOffice, officeEmail: regOfficeEmail };
        };

        // parentRole cascades the parent's assignedRole to subtasks that don't have their own
        const buildSyncTaskValues = (task: any, parentId?: number, parentRole?: string | null) => {
          const ev = resolveEvidence(task);
          const effectiveRole = task.assignedRole || parentRole || null;
          const office = resolveOffice(effectiveRole);
          return {
            regulationId,
            parentTaskId: parentId || null,
            taskId: task.taskId || null,
            title: task.title,
            description: task.description || null,
            instructions: task.instructions || null,
            category: task.category || null,
            assignedRole: effectiveRole,
            responsibleOffice: office.officeName,
            responsibleOfficeEmail: office.officeEmail,
            statutoryRole: task.statutoryRole || null,
            statutoryCitation: task.statutoryCitation || null,
            statutoryLanguage: task.statutoryLanguage || null,
            requirementType: task.requirementType || 'requirement',
            dueDate: resolveDueDate(task),
            recurringSchedule: task.recurringSchedule || null,
            reminderDays: task.reminderDays || 30,
            priority: task.priority || 'medium',
            evidenceRequired: ev.flag,
            evidenceType: task.evidenceType || 'none',
            evidenceInstructions: ev.instructions,
            isConfidential: task.isConfidential || false,
            confidentialDataTypes: task.confidentialDataTypes || null,
            estimatedEffort: task.estimatedEffort || null,
            deliverable: task.deliverable || null,
            deliverableTemplateUrl: task.deliverableTemplateUrl || null,
            sortOrder: task.sortOrder || 0,
            status: 'pending',
            isTemplate: false,
            metadata: task.deadline ? { deadline: task.deadline } : null,
          };
        };
        
        const buildUpdateFields = (task: any, parentRole?: string | null) => {
          const ev = resolveEvidence(task);
          const effectiveRole = task.assignedRole || parentRole || null;
          const office = resolveOffice(effectiveRole);
          return {
            description: task.description || null,
            instructions: task.instructions || null,
            category: task.category || null,
            assignedRole: effectiveRole,
            responsibleOffice: office.officeName,
            responsibleOfficeEmail: office.officeEmail,
            statutoryRole: task.statutoryRole || null,
            statutoryCitation: task.statutoryCitation || null,
            statutoryLanguage: task.statutoryLanguage || null,
            requirementType: task.requirementType || 'requirement',
            priority: task.priority || 'medium',
            evidenceRequired: ev.flag,
            evidenceType: task.evidenceType || 'none',
            evidenceInstructions: ev.instructions,
            isConfidential: task.isConfidential || false,
            confidentialDataTypes: task.confidentialDataTypes || null,
            estimatedEffort: task.estimatedEffort || null,
            deliverable: task.deliverable || null,
            deliverableTemplateUrl: task.deliverableTemplateUrl || null,
            sortOrder: task.sortOrder || 0,
          };
        };
        
        let tasksUpdated = 0;
        let tasksSkipped = 0;
        const syncParentRoleMap = new Map<string, string>();
        
        // First pass: root tasks (no parent)
        console.log(`   ▶️ Pass 1: Processing ${rootTasks.length} root tasks...`);
        for (const task of rootTasks) {
          const existing = preserveTasks ? findExisting(task) : null;
          
          if (existing) {
            if (shouldSkipUpdate(existing)) {
              // Completed/attested — don't touch it
              if (task.tempId) taskIdMap.set(task.tempId, existing.id);
              createdTasks.push({ id: existing.id, tempId: task.tempId, title: task.title });
              tasksSkipped++;
              continue;
            }
            // Update existing task in place — no duplicate
            const updates = buildUpdateFields(task);
            await db.execute(sql`
              UPDATE compliance_tasks SET
                description = ${updates.description},
                instructions = ${updates.instructions},
                category = ${updates.category},
                assigned_role = ${updates.assignedRole},
                responsible_office = ${updates.responsibleOffice},
                responsible_office_email = ${updates.responsibleOfficeEmail},
                statutory_role = ${updates.statutoryRole},
                statutory_citation = ${updates.statutoryCitation},
                statutory_language = ${updates.statutoryLanguage},
                requirement_type = ${updates.requirementType},
                priority = ${updates.priority},
                evidence_required = ${updates.evidenceRequired},
                evidence_type = ${updates.evidenceType},
                evidence_instructions = ${updates.evidenceInstructions},
                estimated_effort = ${updates.estimatedEffort},
                deliverable = ${updates.deliverable},
                deliverable_template_url = ${updates.deliverableTemplateUrl},
                sort_order = ${updates.sortOrder}
              WHERE id = ${existing.id}
            `);
            if (task.tempId) taskIdMap.set(task.tempId, existing.id);
            createdTasks.push({ id: existing.id, tempId: task.tempId, title: task.title });
            tasksUpdated++;
          } else {
            const [newTask] = await db.insert(complianceTasks).values(
              buildSyncTaskValues(task)
            ).returning();
            if (task.tempId) taskIdMap.set(task.tempId, newTask.id);
            createdTasks.push({ id: newTask.id, tempId: task.tempId, title: task.title });
          }

          // Track parent role for cascading to subtasks
          if (task.tempId && task.assignedRole) {
            syncParentRoleMap.set(task.tempId, task.assignedRole);
          }

          // Process inline subtasks[] if present on this root task
          if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
            const parentDbId = task.tempId ? taskIdMap.get(task.tempId) : createdTasks[createdTasks.length - 1]?.id;
            const parentRole = task.assignedRole || null;
            if (parentDbId) {
              for (const sub of task.subtasks) {
                const subExisting = preserveTasks ? findExisting(sub) : null;
                if (subExisting) {
                  if (shouldSkipUpdate(subExisting)) {
                    createdTasks.push({ id: subExisting.id, tempId: sub.tempId, title: sub.title });
                    tasksSkipped++;
                    continue;
                  }
                  const subUpdates = buildUpdateFields(sub, parentRole);
                  await db.execute(sql`
                    UPDATE compliance_tasks SET
                      parent_task_id = ${parentDbId},
                      description = ${subUpdates.description},
                      instructions = ${subUpdates.instructions},
                      category = ${subUpdates.category},
                      assigned_role = ${subUpdates.assignedRole},
                      responsible_office = ${subUpdates.responsibleOffice},
                      responsible_office_email = ${subUpdates.responsibleOfficeEmail},
                      statutory_role = ${subUpdates.statutoryRole},
                      statutory_citation = ${subUpdates.statutoryCitation},
                      statutory_language = ${subUpdates.statutoryLanguage},
                      requirement_type = ${subUpdates.requirementType},
                      priority = ${subUpdates.priority},
                      evidence_required = ${subUpdates.evidenceRequired},
                      evidence_type = ${subUpdates.evidenceType},
                      evidence_instructions = ${subUpdates.evidenceInstructions},
                      estimated_effort = ${subUpdates.estimatedEffort},
                      deliverable = ${subUpdates.deliverable},
                      deliverable_template_url = ${subUpdates.deliverableTemplateUrl},
                      sort_order = ${subUpdates.sortOrder}
                    WHERE id = ${subExisting.id}
                  `);
                  createdTasks.push({ id: subExisting.id, tempId: sub.tempId, title: sub.title });
                  tasksUpdated++;
                } else {
                  const [newSub] = await db.insert(complianceTasks).values(
                    buildSyncTaskValues(sub, parentDbId, parentRole)
                  ).returning();
                  createdTasks.push({ id: newSub.id, tempId: sub.tempId, title: sub.title });
                }
              }
            }
          }
        }
        
        // Second pass: child tasks (with parent via parentTempId — legacy flat format)
        console.log(`   ▶️ Pass 2: Processing ${childTasks.length} child tasks...`);
        console.log(`   🗺️ TaskIdMap has ${taskIdMap.size} entries`);
        
        let childrenCreated = 0;
        let childrenSkipped = 0;
        for (const task of childTasks) {
          const parentId = taskIdMap.get(task.parentTempId!);
          if (!parentId) {
            console.warn(`   ⚠️ Parent not found for child "${task.title}" (parentTempId: ${task.parentTempId})`);
            childrenSkipped++;
            continue;
          }
          
          const parentRole = syncParentRoleMap.get(task.parentTempId!) || null;
          const existing = preserveTasks ? findExisting(task) : null;
          
          if (existing) {
            if (shouldSkipUpdate(existing)) {
              if (task.tempId) taskIdMap.set(task.tempId, existing.id);
              createdTasks.push({ id: existing.id, tempId: task.tempId, title: task.title });
              tasksSkipped++;
              continue;
            }
            const updates = buildUpdateFields(task, parentRole);
            await db.execute(sql`
              UPDATE compliance_tasks SET
                parent_task_id = ${parentId},
                description = ${updates.description},
                instructions = ${updates.instructions},
                category = ${updates.category},
                assigned_role = ${updates.assignedRole},
                responsible_office = ${updates.responsibleOffice},
                responsible_office_email = ${updates.responsibleOfficeEmail},
                statutory_role = ${updates.statutoryRole},
                statutory_citation = ${updates.statutoryCitation},
                statutory_language = ${updates.statutoryLanguage},
                requirement_type = ${updates.requirementType},
                priority = ${updates.priority},
                evidence_required = ${updates.evidenceRequired},
                evidence_type = ${updates.evidenceType},
                evidence_instructions = ${updates.evidenceInstructions},
                estimated_effort = ${updates.estimatedEffort},
                deliverable = ${updates.deliverable},
                deliverable_template_url = ${updates.deliverableTemplateUrl},
                sort_order = ${updates.sortOrder}
              WHERE id = ${existing.id}
            `);
            if (task.tempId) taskIdMap.set(task.tempId, existing.id);
            createdTasks.push({ id: existing.id, tempId: task.tempId, title: task.title });
            tasksUpdated++;
          } else {
            // New child task — insert it
            const [newTask] = await db.insert(complianceTasks).values(
              buildSyncTaskValues(task, parentId, parentRole)
            ).returning();
            if (task.tempId) taskIdMap.set(task.tempId, newTask.id);
            createdTasks.push({ id: newTask.id, tempId: task.tempId, title: task.title });
            childrenCreated++;
          }
        }
        
        const newInserts = createdTasks.length - tasksUpdated - tasksSkipped;
        const taskAction = preserveTasks ? 'Merged' : (isUpdate ? 'Replaced with' : 'Created');
        console.log(`✅ ${taskAction} ${createdTasks.length} compliance tasks`);
        if (preserveTasks) {
          console.log(`   📊 Dedup: ${tasksUpdated} updated, ${newInserts} new, ${tasksSkipped} skipped (completed/attested)`);
        }
        console.log(`   📈 Hierarchy: ${rootTasks.length} parents + ${childrenCreated} children created, ${childrenSkipped} children skipped`);
      }
      
      // Handle topic mappings if provided
      if (data.topics && Array.isArray(data.topics) && data.topics.length > 0) {
        console.log(`🏷️ Processing ${data.topics.length} topic mappings...`);
        
        await db.execute(sql`DELETE FROM regulation_topics WHERE regulation_id = ${regulationId}`);
        
        for (const topic of data.topics) {
          await db.execute(sql`
            INSERT INTO regulation_topics (regulation_id, topic, topic_id, department, responsible_role)
            VALUES (${regulationId}, ${topic.topic || topic.name}, ${topic.topicId || topic.topic_id || null}, 
                    ${topic.department || null}, ${topic.responsibleRole || topic.responsible_role || null})
            ON CONFLICT (regulation_id, topic) DO UPDATE SET
              topic_id = EXCLUDED.topic_id, department = EXCLUDED.department, responsible_role = EXCLUDED.responsible_role
          `);
        }
        
        console.log(`✅ Synced ${data.topics.length} topic mappings`);
      }
      
      // Log to syslog
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Regulation ${isUpdate ? 'updated' : 'created'} via MCP sync: ${data.name}`, {
        regulationId,
        itemId,
        isUpdate,
        taskCount: createdTasks.length,
      } as any);
      
      const taskSyncMode = preserveTasks ? 'merge' : 'replace';

      // Count subtasks (child tasks from both inline subtasks[] and flat parentTempId)
      const inlineSubtaskCount = (data.complianceTasks || []).reduce(
        (sum: number, t: any) => sum + (Array.isArray(t.subtasks) ? t.subtasks.length : 0), 0);
      const flatChildCount = (data.complianceTasks || []).filter((t: any) => t.parentTempId).length;
      const subtaskTotal = inlineSubtaskCount + flatChildCount;
      const sectionCount = (data.complianceTasks || []).filter((t: any) => !t.parentTempId).length;

      // Collect unique roles with deadlines across tasks
      const rolesSet = new Set<string>();
      let deadlineCount = 0;
      for (const t of (data.complianceTasks || [])) {
        if (t.assignedRole) rolesSet.add(t.assignedRole);
        if (t.statutoryRole) rolesSet.add(t.statutoryRole);
        if (t.dueDate || t.deadline?.date) deadlineCount++;
        for (const sub of (t.subtasks || [])) {
          if (sub.assignedRole) rolesSet.add(sub.assignedRole);
          if (sub.dueDate || sub.deadline?.date) deadlineCount++;
        }
      }

      const taskStats = {
        total: createdTasks.length,
        sections: sectionCount,
        subtasks: subtaskTotal,
        penalties: Array.isArray(data.penalties) ? data.penalties.length : 0,
        roles: rolesSet.size,
        deadlines: deadlineCount,
      };

      const metadataSource = data.bespokeSource
        ? 'MCP_ENGINE_BESPOKE_AUDITED'
        : 'MCP_ENGINE_GOLD_CERTIFIED';

      const response = {
        success: true,
        action: isUpdate ? 'updated' : 'created',
        bespokeSource: !!data.bespokeSource,
        message: `Successfully ${isUpdate ? 'updated' : 'created'} regulation "${data.name}" with ${createdTasks.length} compliance tasks (${taskSyncMode} mode)`,
        regulation: {
          id: regulationId,
          regKey: regulationRecord.regKey,
          itemId: regulationRecord.itemId,
          name: regulationRecord.name,
          category: regulationRecord.category,
          jurisdictionSource: regulationRecord.jurisdictionSource,
          riskScore: regulationRecord.riskScore,
          riskLevel: regulationRecord.riskLevel,
        },
        tasks: createdTasks,
        taskStats,
        taskSyncMode,
        taskIdMapping: Object.fromEntries(taskIdMap),
        metadata: { source: metadataSource },
        timestamp,
      };
      
      console.log(`\n✅ SUCCESS: ${isUpdate ? 'Updated' : 'Created'} regulation ID ${regulationId}`);
      console.log(`========================================\n`);
      
      res.status(isUpdate ? 200 : 201).json(response);
      
    } catch (error) {
      console.error('❌ Error syncing regulation:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error syncing regulation via MCP', { error: String(error) } as any);
      
      res.status(500).json({
        success: false,
        error: 'Failed to sync regulation',
        details: error instanceof Error ? error.message : String(error),
        timestamp,
      });
    }
  });

  /**
   * GET /api/mcp/regulations/lookup
   * 
   * Look up a regulation by name or statute to get its EdSteward ID
   * Useful for MCP Engine to check if a regulation exists before creating it
   */
  app.get('/api/mcp/regulations/lookup', basicAuthMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
      const { name, statute, category } = req.query;
      
      if (!name && !statute) {
        return res.status(400).json({
          success: false,
          error: 'Must provide either name or statute query parameter',
        });
      }
      
      let searchResults: any[] = [];
      
      if (name) {
        searchResults = await storage.searchRegulations(String(name));
      }
      
      // Filter by additional criteria if provided
      if (statute && searchResults.length > 0) {
        searchResults = searchResults.filter(r => 
          r.statute.toLowerCase().includes(String(statute).toLowerCase())
        );
      }
      
      if (category && searchResults.length > 0) {
        searchResults = searchResults.filter(r => 
          r.category.toLowerCase() === String(category).toLowerCase()
        );
      }
      
      res.json({
        success: true,
        count: searchResults.length,
        regulations: searchResults.map(r => ({
          id: r.id,
          itemId: r.itemId,
          name: r.name,
          statute: r.statute,
          category: r.category,
          jurisdictionSource: r.jurisdictionSource,
        })),
      });
      
    } catch (error) {
      console.error('Error looking up regulation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to lookup regulation',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/mcp/regulations/:id/tasks
   * 
   * Get all compliance tasks for a regulation
   */
  app.get('/api/mcp/regulations/:id/tasks', basicAuthMCP, async (req: Request, res: Response) => {
    try {
      const storage = getStorage(req);
      const regulationId = parseInt(req.params.id, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const regulation = await storage.getRegulation(regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: 'Regulation not found' });
      }
      
      const tasks = await (storage as any).getComplianceTasks?.(regulationId) || [];
      
      res.json({
        success: true,
        regulationId,
        regulationName: regulation.name,
        taskCount: tasks.length,
        tasks,
      });
      
    } catch (error) {
      console.error('Error fetching regulation tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch regulation tasks',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // =====================================================
  // ALIGNMENT STATUS ENDPOINTS (for MCP Engine verification)
  // =====================================================

  /**
   * GET /api/mcp/alignment-status
   * 
   * Returns comprehensive alignment status for MCP Engine verification
   * Shows regulation counts by jurisdiction, L.O.V.V. level, and related data
   */
  app.get('/api/mcp/alignment-status', basicAuthMCP, async (req: Request, res: Response) => {
    try {
      const db = getDb(req);
      // Updated Jan 2026 to filter by is_current = true for active regulation counts
      const result = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM regulations WHERE is_current = true) as total_regulations,
          (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NOT NULL AND is_current = true) as mcp_validated,
          (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'federal' AND is_current = true) as federal,
          (SELECT COUNT(*) FROM regulations WHERE state_code = 'PA' AND is_current = true) as pennsylvania,
          (SELECT COUNT(*) FROM regulations WHERE state_code = 'NJ' AND is_current = true) as new_jersey,
          (SELECT COUNT(*) FROM regulation_topics) as topic_mappings,
          (SELECT COUNT(*) FROM compliance_tasks) as compliance_tasks,
          (SELECT MAX(last_updated) FROM regulations WHERE is_current = true) as last_sync
      `);
      
      const stats = result.rows[0] as any;
      
      res.json({
        status: 'ok',
        alignment: {
          totalRegulations: parseInt(stats.total_regulations),
          mcpValidated: parseInt(stats.mcp_validated),
          federal: parseInt(stats.federal),
          pennsylvania: parseInt(stats.pennsylvania),
          newJersey: parseInt(stats.new_jersey),
          topicMappings: parseInt(stats.topic_mappings),
          complianceTasks: parseInt(stats.compliance_tasks),
          lastSync: stats.last_sync,
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching alignment status:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error fetching alignment status', { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch alignment status' });
    }
  });

  /**
   * GET /api/mcp/regulation-hashes
   * 
   * Returns item_id and version_hash for all regulations
   * Used by MCP Engine to detect which regulations need updates (diff checking)
   */
  app.get('/api/mcp/regulation-hashes', basicAuthMCP, async (req: Request, res: Response) => {
    try {
      const db = getDb(req);
      const result = await db.execute(sql`
        SELECT item_id, version_hash, lovv_level, last_updated
        FROM regulations
        WHERE item_id IS NOT NULL
        ORDER BY item_id
      `);
      
      res.json({
        count: result.rows.length,
        regulations: result.rows.map((r: any) => ({
          itemId: r.item_id,
          versionHash: r.version_hash,
          lovvLevel: r.lovv_level,
          lastUpdated: r.last_updated,
        }))
      });
      
    } catch (error) {
      console.error('Error fetching regulation hashes:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error fetching regulation hashes', { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to fetch regulation hashes' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CIRCUIT COURT INTERPRETATIONS SYNC (Mar 2026)
  // Receives circuit interpretation data from MCP Engine delivery pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/mcp/circuit-interpretations/sync
   *
   * Receives circuit court interpretation data from the MCP Engine.
   * Upserts interpretations and splits — idempotent by caseName + circuitNumber + regulationId.
   */
  app.post('/api/mcp/circuit-interpretations/sync', basicAuthMCP, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log(`\n========================================`);
    console.log(`🏛️  [${timestamp}] MCP CIRCUIT INTERPRETATIONS SYNC`);
    console.log(`========================================`);

    try {
      const db = getDb(req);
      const { circuitData } = req.body;

      if (!Array.isArray(circuitData) || circuitData.length === 0) {
        return res.status(400).json({ error: 'circuitData array is required' });
      }

      let totalInterpretations = 0;
      let totalSplits = 0;
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const regData of circuitData) {
        const regKey = regData.regKey;
        const regSlug = regData.regulationId;

        // Resolve to EdSteward regulation ID
        const [reg] = await db.select({ id: regulations.id, name: regulations.name })
          .from(regulations)
          .where(regKey ? eq(regulations.regKey, regKey) : eq(regulations.itemId, regSlug));

        if (!reg) {
          errors.push(`Regulation ${regKey || regSlug} not found`);
          continue;
        }

        console.log(`   📋 Processing ${reg.name} (${regKey})`);

        // Upsert circuit splits
        for (const splitData of (regData.circuitSplits || [])) {
          totalSplits++;
          const [existing] = await db.select({ id: circuitSplits.id })
            .from(circuitSplits)
            .where(and(
              eq(circuitSplits.regulationId, reg.id),
              eq(circuitSplits.title, splitData.title),
            ));

          if (existing) {
            // Update existing split
            await db.update(circuitSplits)
              .set({
                description: splitData.description,
                affectedCircuits: splitData.affectedCircuits,
                scotusPetitionPending: splitData.scotusPetitionPending || false,
                scotusCertGranted: splitData.scotusCertGranted || false,
                status: splitData.status || 'active',
                updatedAt: new Date(),
              })
              .where(eq(circuitSplits.id, existing.id));
            skipped++;
          } else {
            await db.insert(circuitSplits).values({
              regulationId: reg.id,
              title: splitData.title,
              description: splitData.description,
              affectedCircuits: splitData.affectedCircuits,
              scotusPetitionPending: splitData.scotusPetitionPending || false,
              scotusCertGranted: splitData.scotusCertGranted || false,
              status: splitData.status || 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            created++;
          }
        }

        // Build a map of split titles to IDs for linking interpretations
        const splitRows = await db.select({ id: circuitSplits.id, title: circuitSplits.title })
          .from(circuitSplits)
          .where(eq(circuitSplits.regulationId, reg.id));
        const splitTitleToId = new Map(splitRows.map(s => [s.title, s.id]));

        // Upsert circuit interpretations
        for (const interp of (regData.interpretations || [])) {
          totalInterpretations++;
          const [existing] = await db.select({ id: circuitInterpretations.id })
            .from(circuitInterpretations)
            .where(and(
              eq(circuitInterpretations.regulationId, reg.id),
              eq(circuitInterpretations.circuitNumber, interp.circuitNumber),
              eq(circuitInterpretations.caseName, interp.caseName),
            ));

          const splitId = interp.splitTitle ? (splitTitleToId.get(interp.splitTitle) || null) : null;

          if (existing) {
            await db.update(circuitInterpretations)
              .set({
                caseYear: interp.caseYear,
                caseCitation: interp.caseCitation,
                courtLevel: interp.courtLevel || 'circuit',
                interpretationType: interp.interpretationType,
                summary: interp.summary,
                complianceImplication: interp.complianceImplication,
                affectedRequirements: interp.affectedRequirements,
                impactSeverity: interp.impactSeverity,
                status: interp.status || 'active',
                isCircuitSplit: interp.isCircuitSplit || false,
                splitId,
                sourceUrl: interp.sourceUrl,
                assessedBy: interp.assessedBy,
                confidenceScore: interp.confidenceScore,
                updatedAt: new Date(),
              })
              .where(eq(circuitInterpretations.id, existing.id));
            skipped++;
          } else {
            await db.insert(circuitInterpretations).values({
              regulationId: reg.id,
              circuitNumber: interp.circuitNumber,
              caseName: interp.caseName,
              caseYear: interp.caseYear,
              caseCitation: interp.caseCitation,
              courtLevel: interp.courtLevel || 'circuit',
              interpretationType: interp.interpretationType,
              summary: interp.summary,
              complianceImplication: interp.complianceImplication,
              affectedRequirements: interp.affectedRequirements,
              impactSeverity: interp.impactSeverity,
              status: interp.status || 'active',
              isCircuitSplit: interp.isCircuitSplit || false,
              splitId,
              sourceUrl: interp.sourceUrl,
              assessedBy: interp.assessedBy,
              confidenceScore: interp.confidenceScore,
              reviewStatus: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            created++;
          }
        }
      }

      console.log(`   ✅ Sync complete: ${created} created, ${skipped} updated, ${errors.length} errors`);

      res.json({
        success: true,
        totalInterpretations,
        totalSplits,
        created,
        updated: skipped,
        errors,
        timestamp,
      });
    } catch (error) {
      console.error('Error syncing circuit interpretations:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error syncing circuit interpretations from MCP Engine', { error: String(error) } as any);
      res.status(500).json({ error: 'Failed to sync circuit interpretations' });
    }
  });
  
}