/**
 * Debug utility for regulation updates API
 * This file contains utility functions to help debug and test the regulation updates feature
 */

import { Express, Request, Response } from 'express';
import { pool } from './db';
import { calculateTextChangeDiff } from './services/diff-calculator';

/**
 * Sets up debug endpoints for regulation updates
 */
export function setupDebugRegulationUpdatesApi(app: Express) {
  // Debug endpoint to directly retrieve regulation updates
  app.get('/api/debug/regulation-update/:id', async (req: Request, res: Response) => {
    try {
      const updateId = parseInt(req.params.id, 10);
      
      if (isNaN(updateId)) {
        return res.status(400).json({ error: 'Invalid update ID' });
      }
      
      // Direct database query to avoid any mapping issues
      const result = await pool.query(
        'SELECT * FROM regulation_updates WHERE id = $1',
        [updateId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Update not found' });
      }
      
      const update = result.rows[0];
      
      // Get the original regulation
      const regResult = await pool.query(
        'SELECT * FROM regulations WHERE id = $1',
        [update.regulation_id]
      );
      
      const regulation = regResult.rows.length > 0 ? regResult.rows[0] : null;
      
      // Calculate the diff
      const diffData = calculateTextChangeDiff(
        regulation?.requirements || '',
        update.updated_content
      );
      
      res.json({
        update,
        regulation,
        diffData
      });
    } catch (error) {
      console.error('Debug endpoint error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Debug endpoint to list all regulation updates
  app.get('/api/debug/regulation-updates', async (req: Request, res: Response) => {
    try {
      const result = await pool.query('SELECT * FROM regulation_updates ORDER BY id DESC');
      res.json(result.rows);
    } catch (error) {
      console.error('Error listing updates:', error);
      res.status(500).json({ error: 'Failed to list updates' });
    }
  });
}