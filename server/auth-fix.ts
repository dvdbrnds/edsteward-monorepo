
import express from "express";
import { storage } from '../storage';

export function applyAuthFix(app: express.Application) {
  console.log('🔓 Applying authentication bypass for /api/regulations');
  
  // Override /api/regulations to be accessible without auth
  app.get('/api/regulations', async (req, res) => {
    try {
      console.log('📋 Getting regulations - AUTH BYPASSED');
      const regulations = await storage.getRegulations();
      console.log(`✅ Found ${regulations.length} regulations`);
      res.json(regulations);
    } catch (error) {
      console.error(`❌ Error getting regulations: ${error}`);
      res.status(500).json({ 
        error: "Failed to fetch regulations", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  console.log('✅ Authentication fix applied');
}
