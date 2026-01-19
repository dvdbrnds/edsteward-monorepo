import express, { type Request, Response } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { regulations, complianceTasks } from "@shared/schema";
import { syslog, LogLevel, LogFacility } from './services/syslog';
import { z } from "zod";
import { ValidationLevel } from "@shared/schema";
import { normalizeCategory } from './services/category-normalizer';

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

  // =====================================================
  // NEW REGULATION CREATION ENDPOINT FOR MCP ENGINE
  // =====================================================
  
  /**
   * Schema for compliance task from MCP Engine
   */
  const mcpComplianceTaskSchema = z.object({
    tempId: z.string().optional(),
    parentTempId: z.string().optional().nullable(),
    title: z.string(),
    description: z.string().optional(),
    instructions: z.string().optional(),
    assignedRole: z.string().optional(),
    dueDate: z.string().optional(),
    recurringSchedule: z.string().optional(),
    reminderDays: z.number().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    evidenceRequired: z.boolean().optional(),
    evidenceType: z.string().optional(),
    evidenceInstructions: z.string().optional(),
    sortOrder: z.number().optional(),
  });

  /**
   * Schema for creating a NEW regulation with compliance tasks
   * This is the correct endpoint for MCP Engine to add regulations that don't exist yet
   */
  const createRegulationWithTasksSchema = z.object({
    // Required fields
    name: z.string().min(1, "Regulation name is required"),
    statute: z.string().min(1, "Statute reference is required"),
    category: z.string().min(1, "Category is required"),
    topic: z.string().min(1, "Topic is required"),
    
    // Optional regulation fields
    itemId: z.string().optional(), // If not provided, will auto-generate
    jurisdictionSource: z.string().default("federal"),
    summary: z.string().optional(),
    requirements: z.string().optional(),
    regulationText: z.string().optional(),
    applicableInstitutions: z.array(z.string()).optional(),
    dro: z.string().optional(),
    effectiveDate: z.string().optional(),
    originationDate: z.string().optional(),
    agency_name: z.string().optional(),
    agency_url: z.string().optional(),
    agency_contact: z.string().optional(),
    agency_department: z.string().optional(),
    regulationUrl: z.string().optional(),
    requirementsUrl: z.string().optional(),
    submissionGuideUrl: z.string().optional(),
    formsUrl: z.string().optional(),
    submissionGuidelines: z.string().optional(),
    reportingFrequency: z.string().optional(),
    filingDeadlines: z.array(z.object({
      type: z.string(),
      date: z.string(),
      frequency: z.string(),
      description: z.string(),
    })).optional(),
    
    // MCP Engine specific fields
    lovvLevel: z.enum(['A', 'B', 'C', 'D']).optional(), // L.O.V.V. validation level
    lastValidated: z.string().optional(), // ISO timestamp of last validation
    version: z.number().optional(), // Version number
    versionHash: z.string().optional(), // SHA-256 hash for change detection
    stateCode: z.string().max(2).optional(), // Two-letter state code (PA, NJ)
    sourceUrl: z.string().optional(), // Original source URL
    
    // Compliance tasks
    complianceTasks: z.array(mcpComplianceTaskSchema).optional(),
    
    // Topic mappings (for multi-topic regulations)
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
    }).optional(),
  });

  /**
   * Basic Auth middleware for MCP Engine (shared with regulation-updates-api)
   * Supports: dvdbrnds:gabadh (Base64: ZHZkYnJuZHM6Z2FiYWRo)
   */
  function basicAuthMCP(req: Request, res: Response, next: Function) {
    // Allow localhost requests to bypass authentication
    const host = req.headers.host || '';
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ 
        error: 'Basic Authentication required',
        message: 'MCP Engine integration requires Basic Auth with valid credentials'
      });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username === 'dvdbrnds' && password === 'gabadh') {
      next();
    } else {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'MCP Engine integration requires valid username and password'
      });
    }
  }

  /**
   * POST /api/mcp/regulations/create
   * 
   * Creates a NEW regulation with optional compliance tasks in a single atomic operation.
   * This is the correct endpoint for MCP Engine to use when adding regulations
   * that don't already exist in EdSteward.
   * 
   * Authentication: Basic Auth (dvdbrnds:gabadh)
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
      
      // Build default actions based on regulation characteristics
      const hasDeadlines = data.filingDeadlines && data.filingDeadlines.length > 0;
      const firstDeadline = hasDeadlines ? data.filingDeadlines[0] : null;
      const defaultActions = [
        {
          type: 'attestation' as const,
          enabled: true,
          required: true,
          status: 'pending' as const,
        },
        {
          type: 'website_publish' as const,
          enabled: false,
          required: false,
          status: 'pending' as const,
        },
        {
          type: 'community_communication' as const,
          enabled: false,
          required: false,
          status: 'pending' as const,
        },
        {
          type: 'agency_submission' as const,
          enabled: hasDeadlines,
          required: hasDeadlines,
          status: 'pending' as const,
          dueDate: firstDeadline?.date || undefined,
        },
      ];
      
      // Create the regulation with all MCP Engine fields
      console.log('💾 Inserting regulation into database...');
      const [newRegulation] = await db.insert(regulations).values({
        itemId,
        name: data.name,
        topic: data.topic,
        statute: data.statute,
        category: data.category,
        jurisdictionSource: data.jurisdictionSource,
        summary: data.summary || null,
        requirements: data.requirements || null,
        regulationText: data.regulationText || null,
        applicableInstitutions: data.applicableInstitutions || null,
        dro: data.dro || '',
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        originationDate: data.originationDate ? new Date(data.originationDate) : null,
        agency_name: data.agency_name || null,
        agency_url: data.agency_url || null,
        agency_contact: data.agency_contact || null,
        agency_department: data.agency_department || null,
        regulationUrl: data.regulationUrl || null,
        requirementsUrl: data.requirementsUrl || null,
        submissionGuideUrl: data.submissionGuideUrl || null,
        formsUrl: data.formsUrl || null,
        submissionGuidelines: data.submissionGuidelines || null,
        reportingFrequency: data.reportingFrequency || null,
        filingDeadlines: data.filingDeadlines || null,
        isApplicable: true,
        isCurrent: true,
        versionNumber: (data as any).version || 1,
        // MCP Engine specific fields
        lovvLevel: (data as any).lovvLevel || null,
        lastValidated: (data as any).lastValidated ? new Date((data as any).lastValidated) : null,
        versionHash: (data as any).versionHash || null,
        stateCode: (data as any).stateCode || null,
        sourceUrl: (data as any).sourceUrl || null,
        // Default actions for compliance workflow
        actions: defaultActions,
      }).returning();
      
      console.log(`✅ Regulation created with ID: ${newRegulation.id}`);
      
      // Create compliance tasks if provided
      const createdTasks: Array<{ id: number; tempId?: string; title: string }> = [];
      const taskIdMap = new Map<string, number>(); // Map tempId to actual ID
      
      if (data.complianceTasks && data.complianceTasks.length > 0) {
        console.log(`📝 Creating ${data.complianceTasks.length} compliance tasks...`);
        
        // First pass: create root tasks (no parent)
        const rootTasks = data.complianceTasks.filter(t => !t.parentTempId);
        for (const task of rootTasks) {
          const [newTask] = await db.insert(complianceTasks).values({
            regulationId: newRegulation.id,
            title: task.title,
            description: task.description || null,
            instructions: task.instructions || null,
            assignedRole: task.assignedRole || null,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            recurringSchedule: task.recurringSchedule || null,
            reminderDays: task.reminderDays || 30,
            priority: task.priority || 'medium',
            evidenceRequired: task.evidenceRequired || false,
            evidenceType: task.evidenceType || 'none',
            evidenceInstructions: task.evidenceInstructions || null,
            sortOrder: task.sortOrder || 0,
            status: 'pending',
            isTemplate: false,
          }).returning();
          
          if (task.tempId) {
            taskIdMap.set(task.tempId, newTask.id);
          }
          createdTasks.push({
            id: newTask.id,
            tempId: task.tempId,
            title: task.title,
          });
        }
        
        // Second pass: create child tasks (with parent)
        const childTasks = data.complianceTasks.filter(t => t.parentTempId);
        for (const task of childTasks) {
          const parentId = taskIdMap.get(task.parentTempId!);
          if (!parentId) {
            console.warn(`⚠️ Could not find parent task with tempId: ${task.parentTempId}`);
            continue;
          }
          
          const [newTask] = await db.insert(complianceTasks).values({
            regulationId: newRegulation.id,
            parentTaskId: parentId,
            title: task.title,
            description: task.description || null,
            instructions: task.instructions || null,
            assignedRole: task.assignedRole || null,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            recurringSchedule: task.recurringSchedule || null,
            reminderDays: task.reminderDays || 30,
            priority: task.priority || 'medium',
            evidenceRequired: task.evidenceRequired || false,
            evidenceType: task.evidenceType || 'none',
            evidenceInstructions: task.evidenceInstructions || null,
            sortOrder: task.sortOrder || 0,
            status: 'pending',
            isTemplate: false,
          }).returning();
          
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
      
      // Log to syslog
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `New regulation created via MCP: ${data.name}`, {
        regulationId: newRegulation.id,
        taskCount: createdTasks.length,
      });
      
      // Success response
      const response = {
        success: true,
        message: `Successfully created regulation "${data.name}" with ${createdTasks.length} compliance tasks`,
        regulation: {
          id: newRegulation.id,
          itemId: newRegulation.itemId,
          name: newRegulation.name,
          category: newRegulation.category,
          jurisdictionSource: newRegulation.jurisdictionSource,
        },
        tasks: createdTasks,
        taskIdMapping: Object.fromEntries(taskIdMap),
        timestamp,
      };
      
      console.log(`\n✅ SUCCESS: Created regulation ID ${newRegulation.id} with ${createdTasks.length} tasks`);
      console.log(`========================================\n`);
      
      res.status(201).json(response);
      
    } catch (error) {
      console.error('❌ Error creating regulation:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error creating regulation via MCP', { 
        error: String(error) 
      });
      
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
      const data = req.body;
      
      // Validate required fields
      if (!data.name || !data.statute || !data.category || !data.topic) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, statute, category, topic',
          timestamp,
        });
      }
      
      // Use regulationId from payload, or generate one
      const itemId = data.regulationId || data.itemId || 
        `REG-${data.name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30).toUpperCase()}-${Date.now()}`;
      
      console.log(`🔍 Looking for existing regulation with item_id: ${itemId}`);
      
      // Normalize category (smart mapping to canonical categories)
      const categoryResult = await normalizeCategory(data.category, { 
        source: data.jurisdictionSource || 'mcp-engine',
        autoCreate: true 
      });
      
      if (categoryResult.isNewMapping) {
        console.log(`🏷️ Auto-mapped category: "${data.category}" → "${categoryResult.canonicalName}" (${(categoryResult.confidence * 100).toFixed(0)}% confidence)`);
      }
      
      // Check if regulation exists by item_id
      const existingReg = await db.select()
        .from(regulations)
        .where(eq(regulations.itemId, itemId))
        .limit(1);
      
      const isUpdate = existingReg.length > 0;
      let regulationId: number;
      let regulationRecord: any;
      
      // Build default actions
      const hasDeadlines = data.filingDeadlines && data.filingDeadlines.length > 0;
      const firstDeadline = hasDeadlines ? data.filingDeadlines[0] : null;
      const defaultActions = [
        { type: 'attestation' as const, enabled: true, required: true, status: 'pending' as const },
        { type: 'website_publish' as const, enabled: false, required: false, status: 'pending' as const },
        { type: 'community_communication' as const, enabled: false, required: false, status: 'pending' as const },
        { type: 'agency_submission' as const, enabled: hasDeadlines, required: hasDeadlines, status: 'pending' as const, dueDate: firstDeadline?.date },
      ];
      
      if (isUpdate) {
        // UPDATE existing regulation
        console.log(`📝 Updating existing regulation ID: ${existingReg[0].id}`);
        
        const [updated] = await db.update(regulations)
          .set({
            name: data.name,
            topic: data.topic,
            statute: data.statute,
            category: categoryResult.canonicalName || data.category, // Use canonical if available
            originalCategory: categoryResult.originalCategory, // Preserve original
            canonicalCategoryId: categoryResult.canonicalId, // Link to canonical
            jurisdictionSource: data.jurisdictionSource || 'federal',
            summary: data.summary || null,
            requirements: data.requirements || null,
            regulationText: data.regulationText || null,
            applicableInstitutions: data.applicableInstitutions || null,
            dro: data.dro || existingReg[0].dro || '',
            effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : existingReg[0].effectiveDate,
            agency_name: data.agency_name || data.agencyName || existingReg[0].agency_name,
            agency_url: data.agency_url || data.agencyUrl || existingReg[0].agency_url,
            regulationUrl: data.regulationUrl || existingReg[0].regulationUrl,
            filingDeadlines: data.filingDeadlines || existingReg[0].filingDeadlines,
            lovvLevel: data.lovvLevel || existingReg[0].lovvLevel,
            lastValidated: data.lastValidated ? new Date(data.lastValidated) : new Date(),
            versionHash: data.versionHash || null,
            stateCode: data.stateCode || existingReg[0].stateCode,
            sourceUrl: data.sourceUrl || existingReg[0].sourceUrl,
            lastUpdated: new Date(),
            // Keep existing actions if not provided, otherwise use defaults
            actions: existingReg[0].actions || defaultActions,
          })
          .where(eq(regulations.id, existingReg[0].id))
          .returning();
        
        regulationId = updated.id;
        regulationRecord = updated;
        
      } else {
        // CREATE new regulation
        console.log(`✨ Creating new regulation with item_id: ${itemId}`);
        
        const [created] = await db.insert(regulations).values({
          itemId,
          name: data.name,
          topic: data.topic,
          statute: data.statute,
          category: categoryResult.canonicalName || data.category, // Use canonical if available
          originalCategory: categoryResult.originalCategory, // Preserve original
          canonicalCategoryId: categoryResult.canonicalId, // Link to canonical
          jurisdictionSource: data.jurisdictionSource || 'federal',
          summary: data.summary || null,
          requirements: data.requirements || null,
          regulationText: data.regulationText || null,
          applicableInstitutions: data.applicableInstitutions || null,
          dro: data.dro || '',
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
          originationDate: data.originationDate ? new Date(data.originationDate) : null,
          agency_name: data.agency_name || data.agencyName || null,
          agency_url: data.agency_url || data.agencyUrl || null,
          regulationUrl: data.regulationUrl || null,
          filingDeadlines: data.filingDeadlines || null,
          isApplicable: true,
          isCurrent: true,
          versionNumber: data.version || 1,
          lovvLevel: data.lovvLevel || null,
          lastValidated: data.lastValidated ? new Date(data.lastValidated) : null,
          versionHash: data.versionHash || null,
          stateCode: data.stateCode || null,
          sourceUrl: data.sourceUrl || null,
          actions: defaultActions,
        }).returning();
        
        regulationId = created.id;
        regulationRecord = created;
      }
      
      // Handle compliance tasks - replace existing if provided
      const createdTasks: Array<{ id: number; tempId?: string; title: string }> = [];
      const taskIdMap = new Map<string, number>();
      
      if (data.complianceTasks && data.complianceTasks.length > 0) {
        console.log(`📝 Processing ${data.complianceTasks.length} compliance tasks...`);
        
        // Delete existing tasks for this regulation (full replacement)
        await db.delete(complianceTasks).where(eq(complianceTasks.regulationId, regulationId));
        
        // First pass: create root tasks (no parent)
        const rootTasks = data.complianceTasks.filter((t: any) => !t.parentTempId);
        for (const task of rootTasks) {
          const [newTask] = await db.insert(complianceTasks).values({
            regulationId,
            title: task.title,
            description: task.description || null,
            instructions: task.instructions || null,
            assignedRole: task.assignedRole || null,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            recurringSchedule: task.recurringSchedule || null,
            reminderDays: task.reminderDays || 30,
            priority: task.priority || 'medium',
            evidenceRequired: task.evidenceRequired || false,
            evidenceType: task.evidenceType || 'none',
            evidenceInstructions: task.evidenceInstructions || null,
            sortOrder: task.sortOrder || 0,
            status: 'pending',
            isTemplate: false,
          }).returning();
          
          if (task.tempId) taskIdMap.set(task.tempId, newTask.id);
          createdTasks.push({ id: newTask.id, tempId: task.tempId, title: task.title });
        }
        
        // Second pass: create child tasks (with parent)
        const childTasks = data.complianceTasks.filter((t: any) => t.parentTempId);
        for (const task of childTasks) {
          const parentId = taskIdMap.get(task.parentTempId!);
          if (!parentId) continue;
          
          const [newTask] = await db.insert(complianceTasks).values({
            regulationId,
            parentTaskId: parentId,
            title: task.title,
            description: task.description || null,
            assignedRole: task.assignedRole || null,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            priority: task.priority || 'medium',
            evidenceRequired: task.evidenceRequired || false,
            evidenceType: task.evidenceType || 'none',
            sortOrder: task.sortOrder || 0,
            status: 'pending',
            isTemplate: false,
          }).returning();
          
          if (task.tempId) taskIdMap.set(task.tempId, newTask.id);
          createdTasks.push({ id: newTask.id, tempId: task.tempId, title: task.title });
        }
        
        console.log(`✅ ${isUpdate ? 'Replaced' : 'Created'} ${createdTasks.length} compliance tasks`);
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
      });
      
      const response = {
        success: true,
        action: isUpdate ? 'updated' : 'created',
        message: `Successfully ${isUpdate ? 'updated' : 'created'} regulation "${data.name}" with ${createdTasks.length} compliance tasks`,
        regulation: {
          id: regulationId,
          itemId: regulationRecord.itemId,
          name: regulationRecord.name,
          category: regulationRecord.category,
          jurisdictionSource: regulationRecord.jurisdictionSource,
        },
        tasks: createdTasks,
        taskIdMapping: Object.fromEntries(taskIdMap),
        timestamp,
      };
      
      console.log(`\n✅ SUCCESS: ${isUpdate ? 'Updated' : 'Created'} regulation ID ${regulationId}`);
      console.log(`========================================\n`);
      
      res.status(isUpdate ? 200 : 201).json(response);
      
    } catch (error) {
      console.error('❌ Error syncing regulation:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error syncing regulation via MCP', { error: String(error) });
      
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
      const regulationId = parseInt(req.params.id, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }
      
      const regulation = await storage.getRegulation(regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: 'Regulation not found' });
      }
      
      const tasks = await storage.getComplianceTasks?.(regulationId) || [];
      
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
      const result = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM regulations) as total_regulations,
          (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NOT NULL) as mcp_validated,
          (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'federal') as federal,
          (SELECT COUNT(*) FROM regulations WHERE state_code = 'PA') as pennsylvania,
          (SELECT COUNT(*) FROM regulations WHERE state_code = 'NJ') as new_jersey,
          (SELECT COUNT(*) FROM regulation_topics) as topic_mappings,
          (SELECT COUNT(*) FROM compliance_tasks) as compliance_tasks,
          (SELECT MAX(last_updated) FROM regulations) as last_sync
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
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error fetching alignment status', { error: String(error) });
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
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error fetching regulation hashes', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch regulation hashes' });
    }
  });
  
}