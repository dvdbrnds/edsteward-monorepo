
import express from "express";
import { storage } from '../storage';

export function applyAuthFix(app: express.Application) {
  
  // Override /api/regulations to be accessible without auth
  app.get('/api/regulations', async (req, res) => {
    try {
      const regulations = await storage.getRegulations();
      res.json(regulations);
    } catch (error) {
      console.error(`❌ Error getting regulations: ${error}`);
      res.status(500).json({ 
        error: "Failed to fetch regulations", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
}
