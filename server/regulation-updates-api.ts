import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { calculateTextChangeDiff } from './services/diff-calculator';
import { z } from 'zod';
import { insertRegulationUpdateSchema } from '@shared/schema';

/**
 * Schema for accepting a regulation update
 */
const acceptUpdateSchema = z.object({
  signature: z.string().min(1, "Signature is required"),
});

/**
 * Schema for rejecting a regulation update
 */
const rejectUpdateSchema = z.object({
  signature: z.string().min(1, "Signature is required"),
  reason: z.string().min(1, "Rejection reason is required"),
});

/**
 * Schema for deferring a regulation update
 */
const deferUpdateSchema = z.object({
  signature: z.string().min(1, "Signature is required"),
});

/**
 * Schema for MCP Engine complex payload
 */
const mcpEngineUpdateSchema = z.object({
  regulationId: z.number(),
  name: z.string(),
  status: z.enum(["pending", "accepted", "rejected", "deferred"]).default("pending"),
  effectiveDate: z.string().optional(),
  content: z.object({
    uscText: z.object({
      title: z.string(),
      section: z.string(),
      text: z.string(),
      lastUpdated: z.string()
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
 * Sets up the regulation update API routes
 * @param app Express application
 */
export function setupRegulationUpdatesApi(app: Express) {
  // Create a new regulation update (for MCP Engine integration)
  app.post('/api/regulation-updates', async (req: Request, res: Response) => {
    try {
      console.log('📋 Regulation update received:', req.body);
      
      let updateData;
      let isTUFVerified = false;
      
      // Try to parse as TUF-verified format first
      const tufValidation = tufUpdateSchema.safeParse(req.body);
      
      if (tufValidation.success) {
        console.log('🔒 Detected TUF-verified format');
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
        // Try to parse as MCP Engine format
        const mcpValidation = mcpEngineUpdateSchema.safeParse(req.body);
        
        if (mcpValidation.success) {
          console.log('✅ Detected MCP Engine format');
          const mcpData = mcpValidation.data;
          
          // Convert MCP Engine format to EdSteward format
          updateData = {
            regulationId: mcpData.regulationId,
            name: mcpData.name,
            status: mcpData.status,
            originalContent: mcpData.content?.uscText?.text || "Original content from MCP Engine",
            updatedContent: JSON.stringify(mcpData.content, null, 2) || "Updated content from MCP Engine"
          };
        } else {
          // Try simple format
          const simpleValidation = insertRegulationUpdateSchema.safeParse(req.body);
          
          if (!simpleValidation.success) {
            console.error('❌ Validation failed for all formats');
            console.error('TUF format errors:', tufValidation.error.issues);
            console.error('MCP format errors:', mcpValidation.error.issues);
            console.error('Simple format errors:', simpleValidation.error.issues);
            
            return res.status(400).json({ 
              error: 'Invalid regulation update data', 
              details: simpleValidation.error.issues 
            });
          }
          
          console.log('✅ Detected simple format');
          updateData = simpleValidation.data;
        }
      }
      
      // Create the regulation update
      const newUpdate = await storage.createRegulationUpdate(updateData);
      
      console.log(`✅ Regulation update created successfully: ${newUpdate.id} ${isTUFVerified ? '(TUF-verified)' : ''}`);
      
      // Return format expected by MCP Engine
      res.status(200).json({
        success: true,
        updateId: newUpdate.id.toString(),
        verified: isTUFVerified,
        hash: isTUFVerified ? updateData.tufHash : undefined
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
      
      // Accept the update
      await storage.acceptRegulationUpdate(
        updateId,
        user.id,
        validationResult.data.signature
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
      
      // Reject the update
      await storage.rejectRegulationUpdate(
        updateId,
        user.id,
        validationResult.data.signature,
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
      
      // Defer the update
      await storage.deferRegulationUpdate(
        updateId,
        user.id,
        validationResult.data.signature
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deferring regulation update:', error);
      res.status(500).json({ error: 'Failed to defer regulation update' });
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
      console.error('❌ TUF health check failed:', error);
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