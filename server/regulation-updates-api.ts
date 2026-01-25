import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { calculateTextChangeDiff } from './services/diff-calculator';
import { z } from 'zod';
import { insertRegulationUpdateSchema, InsertRegulation } from '@shared/schema';
import { pool } from './db';

/**
 * Auto-create a regulation if it doesn't exist (Jan 2026 - MCP Engine workflow)
 * Creates a minimal regulation record so the update can proceed through approval workflow
 * @returns The regulation ID (new or existing)
 */
async function autoCreateRegulationIfNotExists(
  regKey: string | undefined,
  name: string,
  options: {
    statute?: string;
    category?: string;
    topic?: string;
    itemId?: string;
    jurisdictionSource?: string;
    summary?: string;
  } = {}
): Promise<number> {
  // First try to find existing regulation by regKey
  if (regKey) {
    const existingResult = await pool.query(
      'SELECT id FROM regulations WHERE reg_key = $1 AND is_current = true LIMIT 1',
      [regKey]
    );
    if (existingResult.rows.length > 0) {
      return existingResult.rows[0].id;
    }
  }

  // Generate itemId from name if not provided
  const itemId = options.itemId || name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100);

  // Check by itemId too
  const itemIdResult = await pool.query(
    'SELECT id FROM regulations WHERE item_id = $1 AND is_current = true LIMIT 1',
    [itemId]
  );
  if (itemIdResult.rows.length > 0) {
    return itemIdResult.rows[0].id;
  }

  // Create new regulation with minimal required fields
  console.log(`📝 Auto-creating regulation: ${name} (${regKey || itemId})`);
  
  const newRegulation: InsertRegulation = {
    name,
    itemId,
    regKey: regKey || null,
    statute: options.statute || 'Pending',
    category: options.category || 'Uncategorized',
    topic: options.topic || 'General Compliance',
    jurisdictionSource: (options.jurisdictionSource as any) || 'federal',
    summary: options.summary || `Auto-created from MCP Engine update. Pending CCO review.`,
    isApplicable: true,
    isCurrent: true,
    versionNumber: 1,
    versionDate: new Date(),
  };

  const created = await storage.createRegulation(newRegulation);
  console.log(`   ✅ Created regulation ID: ${created.id}`);
  return created.id;
}

// MCP Engine credentials from environment
const MCP_ENGINE_USERNAME = process.env.MCP_ENGINE_USERNAME || 'mcp-engine';
const MCP_ENGINE_PASSWORD = process.env.MCP_ENGINE_PASSWORD;

/**
 * Basic Authentication middleware for MCP Engine integration
 * Credentials configured via MCP_ENGINE_USERNAME and MCP_ENGINE_PASSWORD env vars
 * ALLOWS BYPASS for localhost requests (for local MCP Engine testing)
 */
function basicAuthMiddleware(req: Request, res: Response, next: Function) {
  // Allow localhost requests to bypass authentication
  const host = req.headers.host || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return next();
  }

  // Check if MCP credentials are configured
  if (!MCP_ENGINE_PASSWORD) {
    console.error('MCP_ENGINE_PASSWORD not configured - MCP Engine requests will fail');
    return res.status(500).json({
      error: 'MCP Engine not configured',
      message: 'Server missing MCP_ENGINE_PASSWORD environment variable'
    });
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

  // Validate MCP Engine credentials from environment
  if (username === MCP_ENGINE_USERNAME && password === MCP_ENGINE_PASSWORD) {
    next();
  } else {
    return res.status(401).json({ 
      error: 'Invalid credentials',
      message: 'MCP Engine integration requires valid username and password'
    });
  }
}

/**
 * Schema for accepting a regulation update
 * Note: Signature is now auto-generated from user login information
 */
const acceptUpdateSchema = z.object({
  // No manual signature required - will be auto-generated
});

/**
 * Schema for rejecting a regulation update
 * Note: Signature is now auto-generated from user login information
 */
const rejectUpdateSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

/**
 * Schema for deferring a regulation update
 * Note: Signature is now auto-generated from user login information
 */
const deferUpdateSchema = z.object({
  reason: z.string().optional(),
});

/**
 * Schema for MCP Engine complex payload with Federal Register enhancement
 * Now accepts regKey (REG-001), regulationId (number), or itemId (string) for flexibility
 */
const mcpEngineUpdateSchema = z.object({
  // PRIMARY IDENTIFIER: Universal regulation key (REG-001 to REG-251)
  // MCP Engine should use this as the main identifier for all updates
  regKey: z.string().optional(),
  
  // FALLBACK IDENTIFIERS (used if regKey not provided)
  itemId: z.string().optional(),           // Slug-based ID (e.g., "clery-act-vawa")
  regulationId: z.union([z.number(), z.string()]).optional(), // Legacy numeric ID
  
  name: z.string(),
  
  // Fields for auto-creation if regulation doesn't exist (Jan 2026)
  statute: z.string().optional(),
  category: z.string().optional(),
  topic: z.string().optional(),
  jurisdictionSource: z.string().optional(),
  // Risk metadata from MCP Engine
  riskScore: z.number().optional(),
  riskLevel: z.enum(['CRITICAL', 'SEVERE', 'HIGH', 'MODERATE', 'LOW']).optional(),
  status: z.enum(["pending", "accepted", "rejected", "deferred"]).default("pending"),
  effectiveDate: z.string().optional(),
  
  // Enhanced Federal Register fields
  regulation_text: z.string().optional(),
  summary: z.string().optional(),
  submission_guidelines: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  source_attribution: z.string().optional(),
  
  // Federal Register enhancement metadata
  federal_register_enhancement: z.object({
    attempted: z.boolean(),
    successful: z.boolean(),
    contexts_found: z.number().optional(),
    total_documents_referenced: z.number().optional(),
    error: z.string().optional(),
    fallback_used: z.boolean().optional(),
    contexts: z.array(z.object({
      document_number: z.string(),
      title: z.string(),
      publication_date: z.string(),
      type: z.string(),
      abstract: z.string(),
      full_text: z.string(),
      url: z.string(),
      cached: z.boolean().optional()
    })).optional(),
    all_documents: z.array(z.object({
      document_number: z.string(),
      title: z.string(),
      publication_date: z.string(),
      type: z.string(),
      abstract: z.string(),
      url: z.string()
    })).optional()
  }).optional(),
  
  // Processing metadata
  processing_metadata: z.object({
    processed_at: z.string(),
    enhancement_attempted: z.boolean(),
    enhancement_successful: z.boolean()
  }).optional(),
  
  // Legacy content structure (for backward compatibility)
  content: z.object({
    uscText: z.object({
      title: z.string(),
      section: z.string(),
      text: z.string(),
      lastUpdated: z.string()
    }).optional(),
    requirements: z.object({
      generated: z.boolean(),
      llmModel: z.string().optional(),
      generatedAt: z.string(),
      content: z.string()
    }).optional(),
    cfrGuidance: z.object({
      title: z.string(),
      sections: z.array(z.any()),
      lastUpdated: z.string()
    }).optional(),
    complianceGuide: z.object({
      title: z.string(),
      riskAssessment: z.any(),
      recommendations: z.array(z.any()),
      lastUpdated: z.string()
    }).optional(),
    analysis: z.object({
      workflow: z.string(),
      universityConfidenceScores: z.any(),
      summary: z.string(),
      lastUpdated: z.string()
    }).optional(),
    versioning: z.object({
      currentVersion: z.string(),
      systemInfo: z.any(),
      lastUpdated: z.string()
    }).optional(),
    summary: z.object({
      version: z.string(),
      impact: z.string(),
      changeType: z.string(),
      description: z.string()
    }).optional()
  }).optional(),
  
  // Compliance tasks to be applied on approval (MCP Engine sync Jan 2026)
  complianceTasks: z.array(z.object({
    tempId: z.string().optional(),
    parentTempId: z.string().optional().nullable(),
    taskId: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    instructions: z.string().optional(),
    assignedRole: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    requirementType: z.enum(['requirement', 'best_practice']).optional(),
    dueDate: z.string().optional(),
    evidenceRequired: z.boolean().optional(),
    evidenceType: z.string().optional(),
  })).optional(),
  
  // Executive Orders affecting this regulation (MCP Engine sync Jan 2026)
  executiveOrders: z.array(z.object({
    eoNumber: z.string(),                         // e.g., "EO 14322"
    title: z.string(),
    signedDate: z.string(),                       // ISO date
    status: z.enum(['active', 'enjoined', 'revoked', 'superseded']).optional(),
    president: z.string().optional(),
    term: z.string().optional(),                  // e.g., "Trump-2"
    impactType: z.enum(['modifies', 'reinforces', 'conflicts', 'supersedes']),
    impactSeverity: z.enum(['critical', 'high', 'medium', 'low']),
    impactSummary: z.string().optional(),
    fullTextUrl: z.string().optional(),
    confidenceScore: z.number().optional(),
  })).optional(),
  
  // Filing deadlines (multiple formats supported)
  filingDeadlines: z.any().optional(),
  filing_deadlines: z.any().optional(),
});

/**
 * Schema for TUF-verified regulation update payload
 */
const tufUpdateSchema = z.object({
  regulationId: z.string(),
  verified: z.boolean(),
  hash: z.string(),
  updateTime: z.string(),
  tufPath: z.string(),
  content: z.any(),
  metadata: z.any().optional(),
  source: z.literal("tuf")
});

/**
 * Validates that a regulation ID exists in the database
 * @param regulationId The numeric regulation ID to validate
 * @returns The regulation ID if valid, null if not found
 */
async function validateRegulationId(regulationId: number): Promise<number | null> {
  if (!regulationId || regulationId < 1) {
    return null;
  }
  
  try {
    const result = await pool.query(
      'SELECT id FROM regulations WHERE id = $1',
      [regulationId]
    );
    
    if (result.rows.length > 0) {
      return regulationId;
    }
    return null;
  } catch (error) {
    console.error(`Error validating regulation ID ${regulationId}:`, error);
    return null;
  }
}

/**
 * Looks up a regulation by its item_id (string slug)
 * @param itemId The string item_id (e.g., "jeanne-clery-disclosure-of-campus-security-policy-")
 * @returns The numeric regulation ID if found, null if not found
 */
async function lookupRegulationByItemId(itemId: string): Promise<number | null> {
  if (!itemId || typeof itemId !== 'string') {
    return null;
  }
  
  try {
    const result = await pool.query(
      'SELECT id FROM regulations WHERE item_id = $1',
      [itemId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Error looking up regulation by item_id "${itemId}":`, error);
    return null;
  }
}

/**
 * Looks up a regulation by its universal reg_key (REG-001 to REG-251)
 * @param regKey The universal regulation key (e.g., "REG-001")
 * @returns The numeric regulation ID if found, null if not found
 */
async function lookupRegulationByRegKey(regKey: string): Promise<number | null> {
  if (!regKey || typeof regKey !== 'string') {
    return null;
  }
  
  // Normalize the reg_key format (accept REG-001, REG-1, reg-001, etc.)
  const normalizedKey = regKey.toUpperCase().replace(/REG-0*(\d+)/, 'REG-$1').replace(/REG-(\d)$/, 'REG-00$1').replace(/REG-(\d\d)$/, 'REG-0$1');
  
  try {
    const result = await pool.query(
      'SELECT id FROM regulations WHERE reg_key = $1',
      [normalizedKey]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Error looking up regulation by reg_key "${regKey}":`, error);
    return null;
  }
}

/**
 * Resolves a regulation identifier to a numeric ID
 * Priority order: regKey > itemId > numeric regulationId
 * Accepts:
 * - regKey: Universal key like "REG-001" (highest priority)
 * - itemId: MCP Engine slug like "ferpa"
 * - regulationId: Numeric database primary key
 * @returns The numeric regulation ID if found, null if not found
 */
async function resolveRegulationId(identifier: number | string, regKey?: string): Promise<number | null> {
  // Priority 1: Try regKey lookup (REG-001 format)
  if (regKey && typeof regKey === 'string' && regKey.toUpperCase().startsWith('REG-')) {
    const regKeyResult = await lookupRegulationByRegKey(regKey);
    if (regKeyResult) return regKeyResult;
  }
  
  // Priority 2: Check if identifier itself is a reg_key
  if (typeof identifier === 'string' && identifier.toUpperCase().startsWith('REG-')) {
    const regKeyResult = await lookupRegulationByRegKey(identifier);
    if (regKeyResult) return regKeyResult;
  }
  
  // Priority 3: Numeric ID
  if (typeof identifier === 'number') {
    return await validateRegulationId(identifier);
  } else if (typeof identifier === 'string') {
    // Try to parse as a number (in case it's "519" instead of 519)
    const asNumber = parseInt(identifier, 10);
    if (!isNaN(asNumber)) {
      return await validateRegulationId(asNumber);
    }
    // Otherwise treat as item_id
    return await lookupRegulationByItemId(identifier);
  }
  return null;
}

/**
 * Sets up the regulation update API routes
 * @param app Express application
 */
export function setupRegulationUpdatesApi(app: Express) {
  // MCP Engine bulk import health check endpoint
  app.get('/api/regulation-updates/bulk-import/health', basicAuthMiddleware, async (req: Request, res: Response) => {
    try {
      // Check database connectivity and bulk import readiness
      let dbHealth = true;
      try {
        const pendingCount = await storage.getPendingRegulationUpdates();
        dbHealth = Array.isArray(pendingCount);
      } catch {
        dbHealth = false;
      }
      const pendingCount = dbHealth ? await storage.getPendingRegulationUpdates() : [];
      
      res.status(200).json({
        status: 'ready',
        bulkImportEnabled: true,
        authentication: 'basic-auth-configured',
        database: dbHealth ? 'connected' : 'disconnected',
        pendingUpdates: pendingCount.length,
        maxBatchSize: 500, // Support up to 500 simultaneous updates
        supportedFormats: ['mcp-engine', 'tuf-verified', 'simple'],
        federalRegisterEnhancement: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Bulk import health check failed:', error);
      res.status(503).json({
        status: 'unavailable',
        error: 'Bulk import system not ready',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Create a new regulation update (for MCP Engine integration)
  // Apply Basic Auth middleware for MCP Engine bulk import
  app.post('/api/regulation-updates', basicAuthMiddleware, async (req: Request, res: Response) => {
    try {
      // Enhanced logging for MCP Engine bulk import
      const timestamp = new Date().toISOString();
      const regulationId = req.body.regulationId || req.body.itemId || 'unknown';
      
      let updateData;
      let isTUFVerified = false;
      
      // Try to parse as TUF-verified format first
      const tufValidation = tufUpdateSchema.safeParse(req.body);
      
      if (tufValidation.success) {
        const tufData = tufValidation.data;
        
        if (!tufData.verified) {
          console.error('❌ TUF verification failed - refusing unverified content');
          return res.status(400).json({ 
            success: false,
            error: 'TUF verification failed - content not cryptographically verified' 
          });
        }
        
        // Convert TUF format to EdSteward format
        updateData = {
          regulationId: parseInt(tufData.regulationId.replace('REG-', '')) || 0,
          name: `TUF-Verified: ${tufData.regulationId}`,
          status: 'pending',
          originalContent: JSON.stringify(tufData.metadata, null, 2) || "TUF metadata",
          updatedContent: JSON.stringify(tufData.content, null, 2) || "TUF-verified content",
          // Add TUF-specific metadata
          tufHash: tufData.hash,
          tufPath: tufData.tufPath,
          tufUpdateTime: tufData.updateTime,
          cryptographicallyVerified: true
        };
        
        isTUFVerified = true;
        
      } else {
        // Try simple format first (most common from MCP Engine)
        const simpleValidation = insertRegulationUpdateSchema.safeParse(req.body);
        
        if (simpleValidation.success) {
          const rawData = simpleValidation.data;
          
          // Resolve regulation ID - priority: regKey > itemId > regulationId
          const regKey = req.body.regKey;
          const identifier = req.body.itemId || rawData.regulationId;
          let validRegulationId = await resolveRegulationId(identifier, regKey);
          
          // Auto-create regulation if it doesn't exist (Jan 2026 - MCP Engine workflow)
          if (validRegulationId === null) {
            const regulationName = rawData.name || req.body.name;
            if (!regulationName) {
              return res.status(400).json({ 
                success: false,
                error: 'Cannot auto-create regulation without a name. Provide "name" field.',
              });
            }
            
            console.log(`⚠️ Regulation not found: ${regKey || identifier}. Auto-creating...`);
            validRegulationId = await autoCreateRegulationIfNotExists(regKey, regulationName, {
              statute: req.body.statute,
              category: req.body.category,
              topic: req.body.topic,
              itemId: req.body.itemId,
              jurisdictionSource: req.body.jurisdictionSource,
              summary: req.body.summary,
            });
          }
          
          // Extract structured fields from request body
          const summary = req.body.summary || null;
          const requirements = req.body.requirements || null;
          const filingDeadlines = req.body.filingDeadlines || req.body.filing_deadlines || null;
          const complianceTasks = req.body.complianceTasks || null;
          
          // Log task count for debugging
          if (complianceTasks && complianceTasks.length > 0) {
            console.log(`📋 Received ${complianceTasks.length} compliance tasks for approval workflow`);
          }
          
          updateData = {
            ...rawData,
            regulationId: validRegulationId,
            summary,
            requirements,
            filingDeadlines,
            // Store tasks for approval - will be applied when CCO accepts
            pendingTasks: complianceTasks,
          };
        } else {
          // Try to parse as MCP Engine complex format
          const mcpValidation = mcpEngineUpdateSchema.safeParse(req.body);
          
          if (mcpValidation.success) {
            const mcpData = mcpValidation.data;
            
            // Resolve regulation ID - priority: regKey > itemId > regulationId
            const regKey = mcpData.regKey;
            const identifier = mcpData.itemId || mcpData.regulationId;
            
            if (!regKey && !identifier && !mcpData.name) {
              return res.status(400).json({ 
                success: false,
                error: 'Missing regulation identifier. Provide regKey (REG-001), itemId, regulationId, or name for auto-creation.'
              });
            }
            
            let validRegulationId = await resolveRegulationId(identifier || '', regKey);
            
            // Auto-create regulation if it doesn't exist (Jan 2026 - MCP Engine workflow)
            if (validRegulationId === null) {
              if (!mcpData.name) {
                return res.status(400).json({ 
                  success: false,
                  error: 'Cannot auto-create regulation without a name. Provide "name" field.',
                });
              }
              
              console.log(`⚠️ Regulation not found: ${regKey || identifier}. Auto-creating...`);
              validRegulationId = await autoCreateRegulationIfNotExists(regKey, mcpData.name, {
                statute: (mcpData as any).statute,
                category: (mcpData as any).category,
                topic: (mcpData as any).topic,
                itemId: mcpData.itemId,
                jurisdictionSource: (mcpData as any).jurisdictionSource,
                summary: mcpData.summary,
              });
            }
            
            // Check for Federal Register enhancement
            const hasEnhancement = mcpData.federal_register_enhancement?.attempted;
            const enhancementSuccessful = mcpData.federal_register_enhancement?.successful;
            
            
            // Determine content source based on enhancement status
            let regulationText: string;
            let requirementsContent: string | null = null;
            
            if (hasEnhancement && enhancementSuccessful) {
              // Use enhanced Federal Register content
              regulationText = mcpData.regulation_text || mcpData.content?.uscText?.text || "Enhanced content from Federal Register";
              
              // Handle requirements array from Federal Register enhancement
              if (mcpData.requirements && Array.isArray(mcpData.requirements)) {
                requirementsContent = mcpData.requirements.join('\n• ');
              } else {
                requirementsContent = mcpData.content?.requirements?.content || null;
              }
              
            } else {
              // Fallback to legacy content structure
              regulationText = mcpData.content?.uscText?.text || "Original content from MCP Engine";
              requirementsContent = mcpData.content?.requirements?.content || null;
            }
            
            // Extract summary and filing deadlines from MCP data
            const summaryContent = mcpData.summary || mcpData.content?.summary || null;
            const filingDeadlinesContent = mcpData.filingDeadlines || mcpData.filing_deadlines || mcpData.content?.filing_deadlines || null;
            
            
            // Get compliance tasks from payload
            const complianceTasks = mcpData.complianceTasks || null;
            
            // Log task count for debugging
            if (complianceTasks && complianceTasks.length > 0) {
              console.log(`📋 Received ${complianceTasks.length} compliance tasks for approval workflow`);
            }
            
            // Get executive orders from payload (MCP Engine Jan 2026)
            const executiveOrders = mcpData.executiveOrders || null;
            
            // Log EO count for debugging
            if (executiveOrders && executiveOrders.length > 0) {
              console.log(`⚖️ Received ${executiveOrders.length} Executive Orders affecting this regulation`);
              const critical = executiveOrders.filter((e: any) => e.impactSeverity === 'critical').length;
              if (critical > 0) {
                console.log(`   🔴 ${critical} CRITICAL impact(s) require immediate review`);
              }
            }
            
            // Convert MCP Engine format to EdSteward format
            updateData = {
              regulationId: validRegulationId,
              name: mcpData.name,
              status: mcpData.status,
              originalContent: regulationText,
              updatedContent: regulationText,
              summary: summaryContent,
              requirements: requirementsContent,
              filingDeadlines: filingDeadlinesContent,
              // Store tasks for approval - will be applied when CCO accepts
              pendingTasks: complianceTasks,
              // Store Federal Register metadata for future use
              metadata: {
                federal_register_enhancement: mcpData.federal_register_enhancement,
                processing_metadata: mcpData.processing_metadata,
                source_attribution: mcpData.source_attribution,
                submission_guidelines: mcpData.submission_guidelines,
                enhanced_summary: mcpData.summary,
                // Executive Orders - will be processed on approval
                executiveOrders: executiveOrders,
                eo_count: executiveOrders?.length || 0,
                eo_critical_count: executiveOrders?.filter((e: any) => e.impactSeverity === 'critical').length || 0,
              }
            };
            
          } else {
            console.error('❌ Validation failed for all formats');
            console.error('TUF format errors:', tufValidation.error.issues);
            console.error('Simple format errors:', simpleValidation.error.issues);
            console.error('MCP complex format errors:', mcpValidation.error.issues);
            
            return res.status(400).json({ 
              error: 'Invalid regulation update data', 
              details: simpleValidation.error.issues 
            });
          }
        }
      }
      
      // Create the regulation update with optimized bulk processing
      const newUpdate = await storage.createRegulationUpdate(updateData);
      
      
      // Return exact format expected by MCP Engine for bulk import tracking
      res.status(200).json({
        success: true,
        updateId: newUpdate.id.toString(),
        verified: isTUFVerified,
        hash: isTUFVerified ? updateData.tufHash : undefined,
        // Additional fields for MCP Engine bulk import tracking
        regulationId: regulationId,
        timestamp: timestamp,
        bulkImport: true
      });
    } catch (error) {
      console.error('❌ Error creating regulation update:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create regulation update' 
      });
    }
  });

  // Get all pending regulation updates
  app.get('/api/regulation-updates/pending', async (req: Request, res: Response) => {
    try {
      const updates = await storage.getPendingRegulationUpdates();
      
      // For each update, add the diff statistics
      const updatesWithStats = await Promise.all(
        updates.map(async (update) => {
          // Get the original regulation to compare with
          const regulation = await storage.getRegulation(update.regulationId);
          
          if (!regulation) {
            return {
              ...update,
              changeStats: {
                addedPercentage: 100,
                removedPercentage: 0,
                changedPercentage: 100
              }
            };
          }
          
          // Calculate the diff statistics
          const diffStats = calculateTextChangeDiff(
            regulation.requirements || '',
            update.updatedContent
          );
          
          // Return the update with statistics
          return {
            ...update,
            changeStats: {
              addedPercentage: diffStats.addedPercentage,
              removedPercentage: diffStats.removedPercentage,
              changedPercentage: diffStats.changedPercentage
            }
          };
        })
      );
      
      res.json(updatesWithStats);
    } catch (error) {
      console.error('Error getting pending regulation updates:', error);
      res.status(500).json({ error: 'Failed to get pending regulation updates' });
    }
  });
  
  // Get a specific regulation update by ID
  app.get('/api/regulation-updates/:id', async (req: Request, res: Response) => {
    try {
      const updateId = parseInt(req.params.id, 10);
      
      if (isNaN(updateId)) {
        return res.status(400).json({ error: 'Invalid update ID' });
      }
      
      const update = await storage.getRegulationUpdateById(updateId);
      
      if (!update) {
        return res.status(404).json({ error: 'Regulation update not found' });
      }
      
      // Get the original regulation to generate diff
      const regulation = await storage.getRegulation(update.regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: 'Original regulation not found' });
      }
      
      // Determine content for diff comparison
      // Use regulation_text or requirements from original regulation
      const originalContent = regulation.regulationText || regulation.requirements || '';
      const updatedContent = update.updatedContent || '';
      
      // Calculate detailed diff
      const diffData = calculateTextChangeDiff(originalContent, updatedContent);
      
      // Enhance the update object with all structured fields for transparency
      const enhancedUpdate = {
        ...update,
        // Ensure these fields are explicitly included even if null
        summary: update.summary || null,
        requirements: update.requirements || null,
        filingDeadlines: update.filingDeadlines || null,
        metadata: update.metadata || null,
        originalContent: update.originalContent || null,
        updatedContent: update.updatedContent || null,
        // Add useful context
        regulationName: regulation.name,
        regKey: regulation.regKey || null,
      };
      
      // Enhance the original regulation object with key fields
      // Note: The raw SQL query returns snake_case column names
      const regData = regulation as any; // Access both camelCase and snake_case
      const enhancedOriginal = {
        id: regulation.id,
        name: regulation.name,
        // Handle both snake_case from raw SQL and camelCase from Drizzle
        item_id: regData.item_id || regulation.itemId || null,
        reg_key: regData.reg_key || regulation.regKey || null,
        category: regulation.category,
        topic: regulation.topic,
        jurisdictionSource: regData.jurisdiction_source || regulation.jurisdictionSource,
        statute: regulation.statute,
        summary: regulation.summary || null,
        requirements: regulation.requirements || null,
        regulation_text: regData.regulation_text || regulation.regulationText || null,
        // Filing and deadlines
        filingDeadlines: regData.filing_deadlines || regulation.filingDeadlines || null,
        reportingFrequency: regData.reporting_frequency || regulation.reportingFrequency || null,
        // Risk info
        riskScore: regData.risk_score || regulation.riskScore || null,
        riskLevel: regData.risk_level || regulation.riskLevel || null,
        // Agency info
        agency_name: regData.agency_name || regulation.agencyName || null,
        agency_url: regData.agency_url || regulation.agencyUrl || null,
        // URLs
        regulationUrl: regData.regulation_url || regulation.regulationUrl || null,
        requirementsUrl: regData.requirements_url || regulation.requirementsUrl || null,
        // Dates
        effectiveDate: regData.effective_date || regulation.effectiveDate || null,
        lastUpdated: regData.last_updated || regulation.lastUpdated || null,
        // For backward compatibility
        content: originalContent,
      };
      
      // Fetch current compliance tasks for this regulation (including parent-child hierarchy)
      let currentTasks: any[] = [];
      try {
        const tasksResult = await pool.query(
          `SELECT id, parent_task_id, title, description, status, priority, assigned_role, due_date, 
                  recurring_schedule, evidence_required, evidence_type, evidence_instructions, instructions, sort_order
           FROM compliance_tasks 
           WHERE regulation_id = $1 
           ORDER BY sort_order ASC`,
          [update.regulationId]
        );
        currentTasks = tasksResult.rows;
      } catch (taskError) {
        console.error('Error fetching compliance tasks:', taskError);
      }
      
      // Get pending tasks from the update (will be applied on approval - Jan 2026 MCP Engine sync)
      const pendingTasks = (update as any).pendingTasks || [];
      const hasPendingTasks = pendingTasks && pendingTasks.length > 0;
      
      // If there are pending tasks, use those for display (what will be applied)
      // Otherwise, show current tasks from the regulation
      const tasks = hasPendingTasks ? pendingTasks : currentTasks;
      
      // Count pending task stats for UI
      const pendingTaskStats = hasPendingTasks ? {
        total: pendingTasks.length,
        requirements: pendingTasks.filter((t: any) => t.requirementType === 'requirement').length,
        bestPractices: pendingTasks.filter((t: any) => t.requirementType === 'best_practice').length,
      } : null;
      
      res.json({
        update: enhancedUpdate,
        original: enhancedOriginal,
        diffData,
        tasks,
        pendingTasks: hasPendingTasks ? pendingTasks : null,
        pendingTaskStats,
        currentTasks, // The current tasks (before approval)
      });
    } catch (error) {
      console.error('Error getting regulation update:', error);
      res.status(500).json({ error: 'Failed to get regulation update details' });
    }
  });
  
  // Accept a regulation update
  app.post('/api/regulation-updates/:id/accept', async (req: Request, res: Response) => {
    try {
      const updateId = parseInt(req.params.id, 10);
      
      if (isNaN(updateId)) {
        return res.status(400).json({ error: 'Invalid update ID' });
      }
      
      // Validate request body
      const validationResult = acceptUpdateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.message });
      }
      
      // Get user from session
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const user = req.user;
      
      // Only admins and compliance officers can accept updates
      if (user.role !== 'admin' && user.role !== 'compliance_officer') {
        return res.status(403).json({ error: 'Unauthorized to perform this action' });
      }
      
      // Generate signature automatically from user login information
      const timestamp = new Date().toISOString();
      const fullName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username;
      
      const autoSignature = `Digitally approved by ${fullName} (${user.username}) on ${timestamp}`;
      
      // Accept the update
      await storage.acceptRegulationUpdate(
        updateId,
        user.id,
        autoSignature
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error accepting regulation update:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to accept regulation update', details: errorMessage });
    }
  });
  
  // Reject a regulation update
  app.post('/api/regulation-updates/:id/reject', async (req: Request, res: Response) => {
    try {
      const updateId = parseInt(req.params.id, 10);
      
      if (isNaN(updateId)) {
        return res.status(400).json({ error: 'Invalid update ID' });
      }
      
      // Validate request body
      const validationResult = rejectUpdateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.message });
      }
      
      // Get user from session
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const user = req.user;
      
      // Only admins and compliance officers can reject updates
      if (user.role !== 'admin' && user.role !== 'compliance_officer') {
        return res.status(403).json({ error: 'Unauthorized to perform this action' });
      }
      
      // Generate signature automatically from user login information
      const timestamp = new Date().toISOString();
      const fullName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username;
      
      const autoSignature = `Digitally rejected by ${fullName} (${user.username}) on ${timestamp}`;
      
      // Reject the update
      await storage.rejectRegulationUpdate(
        updateId,
        user.id,
        autoSignature,
        validationResult.data.reason
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error rejecting regulation update:', error);
      res.status(500).json({ error: 'Failed to reject regulation update' });
    }
  });
  
  // Defer a regulation update
  app.post('/api/regulation-updates/:id/defer', async (req: Request, res: Response) => {
    try {
      const updateId = parseInt(req.params.id, 10);
      
      if (isNaN(updateId)) {
        return res.status(400).json({ error: 'Invalid update ID' });
      }
      
      // Validate request body
      const validationResult = deferUpdateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.message });
      }
      
      // Get user from session
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const user = req.user;
      
      // Only admins and compliance officers can defer updates
      if (user.role !== 'admin' && user.role !== 'compliance_officer') {
        return res.status(403).json({ error: 'Unauthorized to perform this action' });
      }
      
      // Generate signature automatically from user login information
      const timestamp = new Date().toISOString();
      const fullName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username;
      
      const autoSignature = `Digitally deferred by ${fullName} (${user.username}) on ${timestamp}`;
      
      // Defer the update
      await storage.deferRegulationUpdate(
        updateId,
        user.id,
        autoSignature
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deferring regulation update:', error);
      res.status(500).json({ error: 'Failed to defer regulation update' });
    }
    });

  // Bulk delete regulation updates (for testing)
  app.delete('/api/regulation-updates/bulk', async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty ids array' });
      }
      
      // Validate all IDs are numbers
      const validIds = ids.filter(id => typeof id === 'number' && !isNaN(id));
      if (validIds.length !== ids.length) {
        return res.status(400).json({ error: 'All IDs must be valid numbers' });
      }
      
      // Get user from session for logging
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const user = req.user;
      
      // Only admins and compliance officers can bulk delete
      if (user.role !== 'admin' && user.role !== 'compliance_officer') {
        return res.status(403).json({ error: 'Unauthorized to perform this action' });
      }
      
      await storage.bulkDeleteRegulationUpdates(validIds);
      
      
      res.json({ 
        success: true, 
        deletedCount: validIds.length,
        deletedIds: validIds
      });
    } catch (error) {
      console.error('Error bulk deleting regulation updates:', error);
      res.status(500).json({ error: 'Failed to bulk delete regulation updates' });
    }
  });
  
  // TUF-specific endpoints
  
  // Get TUF repository health
  app.get('/api/tuf/health', async (req: Request, res: Response) => {
    try {
      const { getTUFService } = await import('./services/tuf-service.js');
      const tufService = getTUFService();
      const health = await tufService.getHealth();
      
      res.json({
        tufRepository: health,
        edstewardIntegration: {
          status: 'healthy',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Check if error indicates circuit breaker is open
      if (error instanceof Error && error.message.includes('temporarily disabled')) {
        res.status(503).json({ 
          error: 'TUF service temporarily disabled',
          details: 'Circuit breaker open - service will retry automatically',
          retryAfter: 300 // 5 minutes
        });
        return;
      }
      
      // Reduce log spam - only log TUF errors once per minute
      const now = Date.now();
      const globalObj = global as Record<string, unknown>;
      if (!globalObj.lastTufErrorLog || now - (globalObj.lastTufErrorLog as number) > 60000) {
        console.error('❌ TUF health check failed:', error instanceof Error ? error.message : 'Unknown error');
        globalObj.lastTufErrorLog = now;
      }
      res.status(500).json({ 
        error: 'TUF repository health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get available regulations from TUF repository
  app.get('/api/tuf/regulations', async (req: Request, res: Response) => {
    try {
      const { getTUFService } = await import('./services/tuf-service.js');
      const tufService = getTUFService();
      const regulations = await tufService.getAvailableRegulations();
      
      res.json({
        regulations,
        count: regulations.length,
        source: 'TUF',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to get TUF regulations:', error);
      res.status(500).json({ 
        error: 'Failed to get regulations from TUF repository',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Download specific regulation from TUF repository
  app.get('/api/tuf/regulations/:regulationId', async (req: Request, res: Response) => {
    try {
      const { getTUFService } = await import('./services/tuf-service.js');
      const regulationId = req.params.regulationId;
      const tufService = getTUFService();
      
      const regulation = await tufService.downloadRegulation(regulationId);
      
      res.json({
        regulation,
        verified: regulation.verified,
        source: 'TUF',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ Failed to download TUF regulation ${req.params.regulationId}:`, error);
      res.status(500).json({ 
        error: 'Failed to download regulation from TUF repository',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Check for TUF regulation updates
  app.get('/api/tuf/check-updates', async (req: Request, res: Response) => {
    try {
      const { getTUFService } = await import('./services/tuf-service.js');
      const tufService = getTUFService();
      const updates = await tufService.checkForUpdates();
      
      res.json({
        updates,
        count: updates.length,
        source: 'TUF',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to check TUF updates:', error);
      res.status(500).json({ 
        error: 'Failed to check for TUF updates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}