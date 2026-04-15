import { Express, Request, Response } from 'express';
import { getDatabaseStorage } from './services/database';
import { calculateTextChangeDiff } from './services/diff-calculator';
import { z } from 'zod';
import { insertRegulationUpdateSchema, InsertRegulation } from '@shared/schema';

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
  } = {},
  tenantId?: string
): Promise<number> {
  // Use tenant-specific storage for database isolation
  const storage = getDatabaseStorage(tenantId);
  
  // First try to find existing regulation by regKey
  if (regKey) {
    const existing = await storage.getRegulationByRegKey?.(regKey);
    if (existing) {
      return existing.id;
    }
  }

  // Generate itemId from name if not provided
  const itemId = options.itemId || name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100);

  // Check by itemId too (only if it looks like a numeric ID)
  const numericId = parseInt(String(itemId), 10);
  if (!isNaN(numericId)) {
    const existingById = await storage.getRegulationById(numericId);
    if (existingById) {
      return existingById.id;
    }
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
    summary: options.summary || `Auto-created from regulation update. Pending CCO review.`,
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
 * Unified MCP Authentication middleware
 * Accepts EITHER:
 *   1. X-MCP-API-Key header (preferred — matches orchestrator endpoint)
 *   2. Basic Auth with MCP_ENGINE_USERNAME/PASSWORD (backward compat)
 * ALLOWS BYPASS for localhost requests (for local MCP Engine testing)
 */
function basicAuthMiddleware(req: Request, res: Response, next: Function) {
  // Allow localhost requests to bypass authentication
  const host = req.headers.host || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return next();
  }

  // Method 1: X-MCP-API-Key header (preferred)
  const apiKey = req.headers['x-mcp-api-key'];
  if (apiKey && apiKey === process.env.MCP_API_KEY) {
    return next();
  }

  // Method 2: Basic Auth (backward compatibility)
  // Check if MCP credentials are configured
  if (!MCP_ENGINE_PASSWORD) {
    // If no Basic Auth password AND no valid API key, fail
    if (!apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Provide X-MCP-API-Key header or Basic Auth credentials'
      });
    }
    return res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided X-MCP-API-Key is not valid'
    });
  }

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
/**
 * Canonical MCP compliance task schema — shared across all endpoints
 * 21 fields per task, standardized Feb 2026
 */
const mcpComplianceTaskSchemaCanonical = z.object({
  tempId: z.string().optional(),
  parentTempId: z.string().optional().nullable(),
  taskId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  category: z.string().optional(),
  assignedRole: z.string().optional(),
  statutoryRole: z.string().optional(),
  statutoryCitation: z.string().optional(),
  requirementType: z.string().optional(),            // Any: requirement, recommendation, best-practice
  priority: z.string().optional(),                   // Any: critical, high, medium, low
  dueDate: z.string().optional(),
  recurringSchedule: z.string().optional(),
  reminderDays: z.number().optional(),
  evidenceRequired: z.boolean().optional(),
  evidenceType: z.string().optional(),
  evidenceInstructions: z.string().optional(),
  estimatedEffort: z.string().optional(),
  deliverable: z.string().optional(),
  deliverableTemplateUrl: z.string().optional(),
  sortOrder: z.number().optional(),
  source: z.string().optional(),                     // "rules-engine", "llm-extractor", "manual"
}).passthrough();

/**
 * Canonical MCP Executive Order schema — 22 fields
 * Standardized Feb 2026
 */
const mcpExecutiveOrderSchemaCanonical = z.object({
  eoNumber: z.string(),
  title: z.string(),
  signedDate: z.string().optional(),
  publishedDate: z.string().optional(),
  status: z.string().optional(),                     // active, enjoined, revoked, superseded
  president: z.string().optional(),
  term: z.string().optional(),
  summary: z.string().optional(),
  fullTextUrl: z.string().optional(),
  pdfUrl: z.string().optional(),
  federalRegisterCitation: z.string().optional(),
  topics: z.array(z.string()).optional(),
  // Accept both canonical and MCP Engine field names
  impactType: z.string().optional(),                 // modifies, reinforces, conflicts, supersedes
  impactSeverity: z.string().optional(),             // critical, high, medium, low
  impactLevel: z.string().optional(),                // MCP Engine alias for impactSeverity
  relevance: z.string().optional(),                  // MCP Engine alias for impactSummary
  impactSummary: z.string().optional(),
  affectedSections: z.array(z.string()).optional(),
  confidenceScore: z.number().optional(),
  assessmentDate: z.string().optional(),
  enjoinedDate: z.string().optional(),
  enjoinedBy: z.string().optional(),
  revokedDate: z.string().optional(),
  revokedBy: z.string().optional(),
}).passthrough();

/**
 * MCP Engine regulation update schema — FULL 48-field payload
 * Expanded Feb 2026 to achieve endpoint parity with Create/Sync
 * Accepts camelCase (canonical) with snake_case fallbacks for backward compat
 */
const mcpEngineUpdateSchema = z.object({
  // PRIMARY IDENTIFIER: Universal regulation key (REG-001 to REG-251)
  regKey: z.string().optional(),
  mcpRegKey: z.string().optional(), // Alias for regKey
  
  // FALLBACK IDENTIFIERS
  itemId: z.string().optional(),
  regulationId: z.union([z.number(), z.string()]).optional(),
  
  name: z.string(),
  
  // Core regulation fields (parity with Create/Sync)
  statute: z.string().optional(),
  statuteIds: z.array(z.string()).optional(),         // Multiple statute identifiers
  publicLaw: z.string().optional(),                   // e.g., "Public Law 101-542"
  category: z.string().optional(),
  topic: z.string().optional(),
  jurisdictionSource: z.string().optional(),
  status: z.enum(["pending", "accepted", "rejected", "deferred"]).default("pending"),
  
  // Dates
  effectiveDate: z.string().optional(),
  originationDate: z.string().optional(),
  nextReviewDate: z.string().optional(),
  
  // Content fields (camelCase canonical, snake_case backward compat)
  regulationText: z.string().optional(),
  regulation_text: z.string().optional(),             // backward compat
  summary: z.string().optional(),
  requirements: z.union([z.string(), z.array(z.string())]).optional(),
  purpose: z.string().optional(),
  scope: z.string().optional(),
  submissionGuidelines: z.string().optional(),
  submission_guidelines: z.string().optional(),       // backward compat
  complianceNotes: z.string().optional(),
  verificationMethod: z.string().optional(),
  reportingFrequency: z.string().optional(),
  reportingRequirements: z.any().optional(),          // Structured reporting requirements
  
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
  relatedRegulations: z.any().optional(),              // Accept string[] or {regKey, relationship}[]
  applicableForms: z.array(z.string()).optional(),
  applicableInstitutions: z.any().optional(),           // String or string[]
  source_attribution: z.string().optional(),
  
  // Agency information
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
  
  // Risk & validation (MCP Engine specific)
  riskScore: z.number().optional(),
  riskLevel: z.string().optional(),                  // Any: CRITICAL, SEVERE, HIGH, MODERATE, LOW
  riskAssessment: z.any().optional(),                 // Full risk assessment object — complex nested structure
  lovvLevel: z.string().optional().nullable(),        // LOVV validation level: A, B, C, D, or null
  versionHash: z.string().optional(),
  stateCode: z.string().optional(),
  countryCode: z.string().optional(),
  
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
  
  // Legacy content structure (backward compatibility)
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
  
  // Compliance tasks — canonical 21-field schema
  complianceTasks: z.array(mcpComplianceTaskSchemaCanonical).optional(),
  
  // Executive Orders — canonical 22-field schema
  executiveOrders: z.array(mcpExecutiveOrderSchemaCanonical).optional(),
  
  // Filing deadlines (multiple formats supported)
  filingDeadlines: z.any().optional(),
  filing_deadlines: z.any().optional(),
  
  // Content fields from MCP Engine spec (accepted for passthrough)
  originalContent: z.string().optional(),
  updatedContent: z.string().optional(),
  cfr: z.string().optional(),
  mcpEngineTimestamp: z.string().optional(),
  
  // Metadata passthrough
  metadata: z.any().optional(),
}).passthrough();

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
async function validateRegulationId(regulationId: number, tenantId?: string): Promise<number | null> {
  if (!regulationId || regulationId < 1) {
    return null;
  }
  
  try {
    const storage = getDatabaseStorage(tenantId);
    const regulation = await storage.getRegulation(regulationId);
    
    if (regulation) {
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
async function lookupRegulationByItemId(itemId: string, tenantId?: string): Promise<number | null> {
  if (!itemId || typeof itemId !== 'string') {
    return null;
  }
  
  try {
    const storage = getDatabaseStorage(tenantId);
    const regulation = await storage.getRegulationById(itemId);
    
    if (regulation) {
      return regulation.id;
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
async function lookupRegulationByRegKey(regKey: string, tenantId?: string): Promise<number | null> {
  if (!regKey || typeof regKey !== 'string') {
    return null;
  }
  
  // Normalize the reg_key format.
  // Accepts: REG-001, REG-1, reg-001, PA-1, pa-001, NJ-3, etc.
  const upper = regKey.toUpperCase();
  const match = upper.match(/^([A-Z]{2,3})-0*(\d+)$/);
  let normalizedKey: string;
  if (match) {
    const prefix = match[1];
    const num = match[2].padStart(3, '0');
    normalizedKey = `${prefix}-${num}`;
  } else {
    normalizedKey = upper;
  }
  
  try {
    const storage = getDatabaseStorage(tenantId);
    const regulation = await storage.getRegulationByRegKey?.(normalizedKey);
    
    if (regulation) {
      return regulation.id;
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
async function resolveRegulationId(identifier: number | string, regKey?: string, tenantId?: string): Promise<number | null> {
  // Priority 1: Try regKey lookup (REG-001 format)
  if (regKey && typeof regKey === 'string' && regKey.toUpperCase().startsWith('REG-')) {
    const regKeyResult = await lookupRegulationByRegKey(regKey, tenantId);
    if (regKeyResult) return regKeyResult;
  }
  
  // Priority 2: Check if identifier itself is a reg_key (REG-XXX, PA-XXX, NJ-XXX, etc.)
  if (typeof identifier === 'string' && /^[A-Za-z]{2,3}-\d+$/i.test(identifier)) {
    const regKeyResult = await lookupRegulationByRegKey(identifier, tenantId);
    if (regKeyResult) return regKeyResult;
  }
  
  // Priority 3: Numeric ID
  if (typeof identifier === 'number') {
    return await validateRegulationId(identifier, tenantId);
  } else if (typeof identifier === 'string') {
    // Try to parse as a number (in case it's "519" instead of 519)
    const asNumber = parseInt(identifier, 10);
    if (!isNaN(asNumber)) {
      return await validateRegulationId(asNumber, tenantId);
    }
    // Otherwise treat as item_id
    return await lookupRegulationByItemId(identifier, tenantId);
  }
  return null;
}

/**
 * Sets up the regulation update API routes
 * @param app Express application
 */
export function setupRegulationUpdatesApi(app: Express) {
  // Helper: Get tenant-aware storage from request
  // CRITICAL: All routes must use this instead of global storage import
  const getStorage = (req: Request) => getDatabaseStorage(req.tenantId);

  // MCP Engine bulk import health check endpoint
  app.get('/api/regulation-updates/bulk-import/health', basicAuthMiddleware, async (req: Request, res: Response) => {
    try {
      // Check database connectivity and bulk import readiness
      const storage = getStorage(req);
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
      const storage = getStorage(req);
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
        // Try to parse as MCP Engine complex format FIRST (most common from MCP Engine GUI)
        const mcpValidation = mcpEngineUpdateSchema.safeParse(req.body);
        
        // Also try simple format
        const simpleValidation = insertRegulationUpdateSchema.safeParse(req.body);
        
        if (mcpValidation.success) {
            const mcpData = mcpValidation.data;
            
            // Resolve regulation ID - priority: regKey > numeric regulationId > itemId
            const regKey = mcpData.regKey || mcpData.mcpRegKey;
            
            if (!regKey && !mcpData.regulationId && !mcpData.itemId && !mcpData.name) {
              return res.status(400).json({ 
                success: false,
                error: 'Missing regulation identifier. Provide regKey (REG-001), itemId, regulationId, or name for auto-creation.'
              });
            }
            
            // Try regKey first, then numeric regulationId, then itemId slug
            let validRegulationId: number | null = null;
            if (regKey) {
              validRegulationId = await resolveRegulationId('', regKey, req.tenantId);
            }
            if (validRegulationId === null && mcpData.regulationId) {
              const numId = typeof mcpData.regulationId === 'number'
                ? mcpData.regulationId
                : parseInt(String(mcpData.regulationId), 10);
              if (!isNaN(numId)) {
                validRegulationId = await validateRegulationId(numId, req.tenantId);
              }
            }
            if (validRegulationId === null && mcpData.itemId) {
              validRegulationId = await resolveRegulationId(mcpData.itemId, undefined, req.tenantId);
            }
            
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
              }, req.tenantId);
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
            const summaryContent = typeof mcpData.summary === 'string' ? mcpData.summary : (mcpData.content?.summary || null);
            const rawFilingDeadlines = mcpData.filingDeadlines || mcpData.filing_deadlines || mcpData.content?.filing_deadlines || null;
            // filing_deadlines column is TEXT — stringify arrays/objects for storage
            const filingDeadlinesContent = rawFilingDeadlines && typeof rawFilingDeadlines !== 'string'
              ? JSON.stringify(rawFilingDeadlines)
              : rawFilingDeadlines;
            
            
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
            // Resolve camelCase vs snake_case field names (prefer camelCase)
            const resolvedRegText = mcpData.regulationText || mcpData.regulation_text;
            const resolvedSubmissionGuidelines = mcpData.submissionGuidelines || mcpData.submission_guidelines;
            const resolvedAgencyName = mcpData.agencyName || mcpData.agency_name;
            const resolvedAgencyUrl = mcpData.agencyUrl || mcpData.agency_url;
            const resolvedAgencyContact = mcpData.agencyContact || mcpData.agency_contact;
            const resolvedAgencyDepartment = mcpData.agencyDepartment || mcpData.agency_department;
            
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
              // Store the COMPLETE raw payload for CCO review (Feb 2026)
              mcpPayload: req.body,
              // Store ALL MCP fields as metadata for processing on approval
              metadata: {
                // Federal Register enhancement
                federal_register_enhancement: mcpData.federal_register_enhancement,
                processing_metadata: mcpData.processing_metadata,
                source_attribution: mcpData.source_attribution,
                enhanced_summary: mcpData.summary,
                // Executive Orders - will be processed on approval
                executiveOrders: executiveOrders,
                eo_count: executiveOrders?.length || 0,
                eo_critical_count: executiveOrders?.filter((e: any) => e.impactSeverity === 'critical').length || 0,
                // Expanded regulation fields (Feb 2026 schema alignment)
                regulationFields: {
                  statute: mcpData.statute,
                  statuteIds: mcpData.statuteIds,
                  publicLaw: mcpData.publicLaw,
                  category: mcpData.category,
                  topic: mcpData.topic,
                  jurisdictionSource: mcpData.jurisdictionSource,
                  effectiveDate: mcpData.effectiveDate,
                  originationDate: mcpData.originationDate,
                  nextReviewDate: mcpData.nextReviewDate,
                  purpose: mcpData.purpose,
                  scope: mcpData.scope,
                  submissionGuidelines: resolvedSubmissionGuidelines,
                  complianceNotes: mcpData.complianceNotes,
                  verificationMethod: mcpData.verificationMethod,
                  reportingFrequency: mcpData.reportingFrequency,
                  reportingRequirements: mcpData.reportingRequirements,
                  applicableInstitutions: mcpData.applicableInstitutions,
                  applicableForms: mcpData.applicableForms,
                  sources: mcpData.sources,
                  sections: mcpData.sections,
                  relatedRegulations: mcpData.relatedRegulations,
                  // Agency info
                  agencyName: resolvedAgencyName,
                  agencyUrl: resolvedAgencyUrl,
                  agencyContact: resolvedAgencyContact,
                  agencyDepartment: resolvedAgencyDepartment,
                  enforcementAgency: mcpData.enforcementAgency,
                  // URLs
                  regulationUrl: mcpData.regulationUrl,
                  requirementsUrl: mcpData.requirementsUrl,
                  submissionGuideUrl: mcpData.submissionGuideUrl,
                  formsUrl: mcpData.formsUrl,
                  sourceUrl: mcpData.sourceUrl,
                  // Risk & validation
                  riskScore: mcpData.riskScore,
                  riskLevel: mcpData.riskLevel,
                  riskAssessment: mcpData.riskAssessment,
                  lovvLevel: mcpData.lovvLevel,
                  versionHash: mcpData.versionHash,
                  stateCode: mcpData.stateCode,
                },
                // Passthrough any additional metadata from MCP
                ...(mcpData.metadata || {}),
              }
            };
            
          } else if (simpleValidation.success) {
            // Fallback to simple format
            const rawData = simpleValidation.data;
          
            // Resolve regulation ID - priority: regKey > itemId > regulationId
            const regKey = req.body.regKey || req.body.mcpRegKey;
            const identifier = req.body.itemId || rawData.regulationId;
            let validRegulationId = await resolveRegulationId(identifier, regKey, req.tenantId);
          
            // Auto-create regulation if it doesn't exist
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
              }, req.tenantId);
            }
          
            const summary = req.body.summary || null;
            const rawRequirements = req.body.requirements || null;
            // requirements column is TEXT — stringify arrays
            const requirements = rawRequirements && Array.isArray(rawRequirements)
              ? rawRequirements.join('\n• ')
              : rawRequirements;
            const rawFilingDeadlines = req.body.filingDeadlines || req.body.filing_deadlines || null;
            // filing_deadlines column is TEXT — stringify arrays/objects
            const filingDeadlines = rawFilingDeadlines && typeof rawFilingDeadlines !== 'string'
              ? JSON.stringify(rawFilingDeadlines)
              : rawFilingDeadlines;
            const complianceTasks = req.body.complianceTasks || null;
          
            if (complianceTasks && complianceTasks.length > 0) {
              console.log(`📋 Received ${complianceTasks.length} compliance tasks for approval workflow`);
            }
          
            updateData = {
              ...rawData,
              regulationId: validRegulationId,
              summary,
              requirements,
              filingDeadlines,
              pendingTasks: complianceTasks,
              mcpPayload: req.body, // Store full payload for CCO review
            };
          } else {
            console.error('❌ Validation failed for all formats');
            console.error('TUF format errors:', tufValidation.error.issues);
            console.error('Simple format errors:', simpleValidation.error.issues);
            console.error('MCP complex format errors:', mcpValidation.error.issues);
            
            return res.status(400).json({ 
              error: 'Invalid regulation update data', 
              details: [
                ...simpleValidation.error.issues.map((i: any) => ({ ...i, format: 'simple' })),
                ...mcpValidation.error.issues.map((i: any) => ({ ...i, format: 'mcp-engine' })),
              ]
            });
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
      const storage = getStorage(req);
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
      const storage = getStorage(req);
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
        // Complete MCP Engine payload (Feb 2026 — verbatim storage for CCO review)
        mcpPayload: (update as any).mcpPayload || null,
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
        const db = storage.getDb();
        if (db) {
          const tasksResult = await db.execute(
            `SELECT id, parent_task_id, title, description, status, priority, assigned_role, due_date, 
                    recurring_schedule, evidence_required, evidence_type, evidence_instructions, instructions, sort_order
             FROM compliance_tasks 
             WHERE regulation_id = ${update.regulationId}
             ORDER BY sort_order ASC`
          );
          currentTasks = tasksResult.rows as any[];
        }
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
      const storage = getStorage(req);
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
      const storage = getStorage(req);
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
      const storage = getStorage(req);
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
      const storage = getStorage(req);
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