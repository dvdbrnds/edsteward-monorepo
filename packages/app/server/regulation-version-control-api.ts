import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { z } from 'zod';

/**
 * Enhanced Regulation Version Control API
 * Provides comprehensive version control, timeline, and rollback functionality
 */

const rollbackSchema = z.object({
  versionId: z.number().int().positive(),
  reason: z.string().optional()
});

export function setupRegulationVersionControlApi(app: Express) {
  
  // Get all versions for a specific regulation
  app.get('/api/regulations/:id/versions', async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.id, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }

      // Get user from session for authorization
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }


      const versions = await storage.getRegulationVersions(regulationId);
      
      
      res.json(versions);
    } catch (error) {
      console.error('Error fetching regulation versions:', error);
      res.status(500).json({ error: 'Failed to fetch regulation versions' });
    }
  });

  // Get pending updates for a specific regulation
  app.get('/api/regulations/:id/pending-updates', async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.id, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }

      // Get user from session for authorization
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }


      const pendingUpdates = await storage.getPendingUpdatesForRegulation(regulationId);
      
      
      res.json(pendingUpdates);
    } catch (error) {
      console.error('Error fetching pending updates:', error);
      res.status(500).json({ error: 'Failed to fetch pending updates' });
    }
  });

  // Get detailed version comparison
  app.get('/api/regulations/:id/versions/:versionA/compare/:versionB', async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.id, 10);
      const versionAId = parseInt(req.params.versionA, 10);
      const versionBId = parseInt(req.params.versionB, 10);
      
      if (isNaN(regulationId) || isNaN(versionAId) || isNaN(versionBId)) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      // Get user from session for authorization
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }


      const comparison = await storage.compareRegulationVersions(versionAId, versionBId);
      
      res.json(comparison);
    } catch (error) {
      console.error('Error comparing versions:', error);
      res.status(500).json({ error: 'Failed to compare versions' });
    }
  });

  // Rollback to a specific version
  app.post('/api/regulations/:id/rollback', async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.id, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }

      // Validate request body
      const validationResult = rollbackSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.message });
      }

      const { versionId, reason } = validationResult.data;

      // Get user from session for authorization
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user;

      // Only admins and compliance officers can rollback
      if (user.role !== 'admin' && user.role !== 'compliance_officer') {
        return res.status(403).json({ error: 'Unauthorized to perform rollback' });
      }


      // Get the target version
      const targetVersion = await storage.getRegulationVersion(versionId);
      if (!targetVersion || targetVersion.regulationId !== regulationId) {
        return res.status(404).json({ error: 'Version not found' });
      }

      // Create a new version with the content from the target version
      const rollbackVersion = await storage.createRegulationVersion({
        regulationId,
        content: targetVersion.content,
        versionNumber: targetVersion.versionNumber + 1,
        createdBy: user.id,
        source: 'rollback',
        sourceId: `rollback-from-v${targetVersion.versionNumber}`
      });

      // Update the main regulation record with the rolled-back content
      await storage.updateRegulationContent(regulationId, targetVersion.content, user.id);

      // Log the rollback action

      // Create audit log entry
      await storage.createAuditLogEntry({
        userId: user.id,
        action: 'regulation_rollback',
        resourceType: 'regulation',
        resourceId: regulationId,
        details: {
          targetVersionId: versionId,
          targetVersionNumber: targetVersion.versionNumber,
          newVersionId: rollbackVersion.id,
          newVersionNumber: rollbackVersion.versionNumber,
          reason
        }
      });

      res.json({
        success: true,
        newVersion: rollbackVersion,
        message: `Successfully rolled back to version ${targetVersion.versionNumber}`
      });

    } catch (error) {
      console.error('Error rolling back regulation:', error);
      res.status(500).json({ error: 'Failed to rollback regulation' });
    }
  });

  // Get regulation timeline with all events
  app.get('/api/regulations/:id/timeline', async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.id, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }

      // Get user from session for authorization
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }


      const timeline = await storage.getRegulationTimeline(regulationId);
      
      
      res.json(timeline);
    } catch (error) {
      console.error('Error fetching regulation timeline:', error);
      res.status(500).json({ error: 'Failed to fetch regulation timeline' });
    }
  });

  // Create a snapshot/checkpoint of current regulation state
  app.post('/api/regulations/:id/snapshot', async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.id, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }

      // Get user from session for authorization
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user;

      // Only admins and compliance officers can create snapshots
      if (user.role !== 'admin' && user.role !== 'compliance_officer') {
        return res.status(403).json({ error: 'Unauthorized to create snapshots' });
      }

      const { reason } = req.body;


      // Get current regulation content
      const regulation = await storage.getRegulation(regulationId);
      if (!regulation) {
        return res.status(404).json({ error: 'Regulation not found' });
      }

      // Create a new version as a snapshot
      const snapshot = await storage.createRegulationVersion({
        regulationId,
        content: regulation.summary || '',
        versionNumber: 0,
        createdBy: user.id,
        source: 'local',
        sourceId: `snapshot-${Date.now()}`
      } as any);


      res.json({
        success: true,
        snapshot,
        message: `Snapshot created as version ${snapshot.versionNumber}`
      });

    } catch (error) {
      console.error('Error creating regulation snapshot:', error);
      res.status(500).json({ error: 'Failed to create regulation snapshot' });
    }
  });

  // Get version statistics and analytics
  app.get('/api/regulations/:id/version-stats', async (req: Request, res: Response) => {
    try {
      const regulationId = parseInt(req.params.id, 10);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: 'Invalid regulation ID' });
      }

      // Get user from session for authorization
      if (!req.session || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }


      const stats = await storage.getRegulationVersionStats(regulationId);
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching version statistics:', error);
      res.status(500).json({ error: 'Failed to fetch version statistics' });
    }
  });

}
