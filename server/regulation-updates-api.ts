import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { calculateTextChangeDiff } from './services/diff-calculator';
import { z } from 'zod';
import { insertRegulationUpdateSchema } from '@shared/schema';

/**
 * Basic Authentication middleware for MCP Engine integration
 * Supports the credentials: dvdbrnds:gabadh (Base64: ZHZkYnJuZHM6Z2FiYWRo)
 */
function basicAuthMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.log('🔒 Missing or invalid Authorization header for MCP Engine');
    return res.status(401).json({ 
      error: 'Basic Authentication required',
      message: 'MCP Engine integration requires Basic Auth with valid credentials'
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // Validate MCP Engine credentials
  if (username === 'dvdbrnds' && password === 'gabadh') {
    console.log('✅ MCP Engine Basic Auth successful for bulk import');
    next();
  } else {
    console.log('❌ Invalid MCP Engine credentials:', username);
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
 */
const mcpEngineUpdateSchema = z.object({
  regulationId: z.number(),
  name: z.string(),
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
  }).optional()
});

// TUF schema removed - deprecated system

/**
 * Maps MCP Engine sequential IDs (1-354) to actual EdSteward regulation IDs (4459-4852)
 * @param mcpId Sequential ID from MCP Engine (1-354)
 * @returns Actual EdSteward regulation ID or null if invalid
 */
function validateRegulationId(regulationId: number): number | null {
  // EdSteward now uses Master Key Field system: sequential IDs 1-354
  // No mapping needed - use regulation IDs directly
  if (regulationId < 1 || regulationId > 354) {
    return null;
  }
  
  // Return the regulation ID as-is (no conversion needed)
  return regulationId;
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
        supportedFormats: ['mcp-engine', 'simple'],
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
      const regulationId = req.body.regulationId || 'unknown';
      const regulationName = req.body.name || 'unnamed';
      
      console.log(`📋 [${timestamp}] MCP Engine bulk import - Regulation ${regulationId}: ${regulationName}`);
      
      // Log Federal Register enhancement status if present
      if (req.body.federal_register_enhancement) {
        const enhancement = req.body.federal_register_enhancement;
        console.log(`🔍 Federal Register Enhancement: attempted=${enhancement.attempted}, successful=${enhancement.successful}, contexts=${enhancement.contexts_found || 0}`);
      }
      
      let updateData;
      
      // Try simple format first (most common from MCP Engine)
      const simpleValidation = insertRegulationUpdateSchema.safeParse(req.body);
      
      if (simpleValidation.success) {
        console.log('✅ Detected simple format');
        const rawData = simpleValidation.data;
        
        // Validate regulation ID (Master Key Field system: 1-354)
        const validRegulationId = validateRegulationId(rawData.regulationId);
        
        if (validRegulationId === null) {
              console.error(`❌ Invalid regulation ID: ${rawData.regulationId}. Must be between 1-354.`);
              return res.status(400).json({ 
                success: false,
                error: `Invalid regulation ID: ${rawData.regulationId}. Use IDs 1-354 for Master Key Field system.` 
              });
            }
            
            console.log(`✅ Using Master Key Field ID ${validRegulationId} directly`);
            
            updateData = {
              ...rawData,
              regulationId: validRegulationId
            };
        } else {
          // Try to parse as MCP Engine complex format
          const mcpValidation = mcpEngineUpdateSchema.safeParse(req.body);
          
          if (mcpValidation.success) {
            console.log('✅ Detected MCP Engine complex format');
            const mcpData = mcpValidation.data;
            
            // Validate regulation ID (Master Key Field system: 1-354)
            const validRegulationId = validateRegulationId(mcpData.regulationId);
            
            if (validRegulationId === null) {
              console.error(`❌ Invalid regulation ID: ${mcpData.regulationId}. Must be between 1-354.`);
              return res.status(400).json({ 
                success: false,
                error: `Invalid regulation ID: ${mcpData.regulationId}. Use IDs 1-354 for Master Key Field system.` 
              });
            }
            
            console.log(`✅ Using Master Key Field ID ${validRegulationId} directly`);
            
            // Check for Federal Register enhancement
            const hasEnhancement = mcpData.federal_register_enhancement?.attempted;
            const enhancementSuccessful = mcpData.federal_register_enhancement?.successful;
            
            console.log('🔍 Federal Register Enhancement Status:');
            console.log('   attempted:', hasEnhancement);
            console.log('   successful:', enhancementSuccessful);
            console.log('   contexts_found:', mcpData.federal_register_enhancement?.contexts_found || 0);
            console.log('   total_documents:', mcpData.federal_register_enhancement?.total_documents_referenced || 0);
            
            // Determine content source based on enhancement status
            let regulationText: string;
            let requirementsContent: string | null = null;
            
            if (hasEnhancement && enhancementSuccessful) {
              // Use enhanced Federal Register content
              regulationText = mcpData.regulation_text || mcpData.content?.uscText?.text || "Enhanced content from Federal Register";
              
              // Handle requirements array from Federal Register enhancement
              if (mcpData.requirements && Array.isArray(mcpData.requirements)) {
                requirementsContent = mcpData.requirements.join('\n• ');
                console.log('✅ Using enhanced requirements array:', mcpData.requirements.length, 'items');
              } else {
                requirementsContent = mcpData.content?.requirements?.content || null;
              }
              
              console.log('✅ Using Federal Register enhanced content');
              console.log('   source_attribution:', mcpData.source_attribution);
              console.log('   submission_guidelines available:', !!mcpData.submission_guidelines);
            } else {
              // Fallback to legacy content structure
              regulationText = mcpData.content?.uscText?.text || "Original content from MCP Engine";
              requirementsContent = mcpData.content?.requirements?.content || null;
              
              if (hasEnhancement && !enhancementSuccessful) {
                console.log('⚠️ Federal Register enhancement failed, using fallback content');
                console.log('   error:', mcpData.federal_register_enhancement?.error);
              } else {
                console.log('✅ Using legacy content structure');
              }
            }
            
            // Convert MCP Engine format to EdSteward format
            updateData = {
              regulationId: validRegulationId,
              name: mcpData.name,
              status: mcpData.status,
              originalContent: regulationText,
              updatedContent: regulationText,
              requirements: requirementsContent,
              // Store Federal Register metadata for future use
              metadata: {
                federal_register_enhancement: mcpData.federal_register_enhancement,
                processing_metadata: mcpData.processing_metadata,
                source_attribution: mcpData.source_attribution,
                submission_guidelines: mcpData.submission_guidelines,
                enhanced_summary: mcpData.summary
              }
            };
            
            console.log('🔍 Debug updateData object:');
            console.log('   regulationId:', updateData.regulationId);
            console.log('   name:', updateData.name);
            console.log('   updatedContent length:', updateData.updatedContent?.length);
            console.log('   requirements:', updateData.requirements ? `HAS_CONTENT (${updateData.requirements.length} chars)` : 'NULL');
            console.log('   enhancement_metadata:', !!updateData.metadata?.federal_register_enhancement);
          } else {
            console.error('❌ Validation failed for all formats');
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
      
      console.log(`✅ [BULK-IMPORT] Regulation ${regulationId} processed successfully - Update ID: ${newUpdate.id}`);
      
      // Return exact format expected by MCP Engine for bulk import tracking
      res.status(200).json({
        success: true,
        updateId: newUpdate.id.toString(),
        verified: false,
        hash: undefined,
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
      
      // Calculate detailed diff
      const diffData = calculateTextChangeDiff(
        regulation.requirements || '',
        update.updatedContent
      );
      
      res.json({
        update,
        original: regulation,
        diffData
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
      res.status(500).json({ error: 'Failed to accept regulation update' });
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
      
      console.log(`✅ Bulk deleted ${validIds.length} regulation updates by user ${user.username}`);
      
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
  
  console.log('📋 Regulation Updates API routes registered (TUF endpoints removed)');
}