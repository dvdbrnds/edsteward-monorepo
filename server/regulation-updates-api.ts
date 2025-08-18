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
 * Sets up the regulation update API routes
 * @param app Express application
 */
export function setupRegulationUpdatesApi(app: Express) {
  // Create a new regulation update (for MCP Engine integration)
  app.post('/api/regulation-updates', async (req: Request, res: Response) => {
    try {
      console.log('📋 MCP Engine regulation update received:', req.body);
      
      // Validate the request body
      const validationResult = insertRegulationUpdateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error('❌ Validation failed:', validationResult.error.message);
        return res.status(400).json({ 
          error: 'Invalid regulation update data', 
          details: validationResult.error.issues 
        });
      }
      
      // Create the regulation update
      const newUpdate = await storage.createRegulationUpdate(validationResult.data);
      
      console.log('✅ Regulation update created successfully:', newUpdate.id);
      
      res.status(201).json({
        success: true,
        update: newUpdate,
        message: `Regulation update ${newUpdate.id} created and ready for review`
      });
    } catch (error) {
      console.error('❌ Error creating regulation update:', error);
      res.status(500).json({ error: 'Failed to create regulation update' });
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
}