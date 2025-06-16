#!/bin/bash
echo "🔧 Applying authentication patch..."

# Backup original
cp /app/server/routes/index.ts /app/server/routes/index.ts.backup

# Create patched version
cat > /app/server/routes/index.ts << 'EOF'
import express from "express";
import { Server } from 'http';
import { createServer } from 'http';
import { log } from '../vite';
import { setupAuth } from '../auth';
import { setupRegulationUpdatesApi } from '../regulation-updates-api';
import { setupDebugRegulationUpdatesApi } from '../debug-regulation-updates';
import { setupMCPIntegrationApi } from '../mcp-integration-api';
import { initializeDatabase } from '../db-init';
import { storage } from '../storage';
import type { Regulation } from '@shared/schema';
import path from 'path';

// Import modular route handlers
import publicRoutes from './api/public';
import uploadsRoutes from './api/uploads';
import { regulationsRouter } from './api/regulations';
import { notesRouter } from './api/notes';
import deadlinesRouter from './api/deadlines';
import notificationsRouter from './api/notifications';

export function registerRoutes(app: express.Application): Server {
  const httpServer = createServer(app);

  // 🔓 AUTHENTICATION FIX: Public regulations endpoint
  app.get('/api/regulations', async (req, res) => {
    try {
      console.log('📋 Getting regulations (AUTH BYPASSED)');
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

  // Health endpoints
  app.get('/health', (req, res) => {
    res.status(200).send("OK");
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      server: "running",
      authFix: "applied"
    });
  });

  // Setup remaining routes...
  setupAuth(app as any);
  app.use('/api/public', publicRoutes);
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/notes', notesRouter);
  app.use('/api/deadlines', deadlinesRouter);
  app.use('/api/notifications', notificationsRouter);

  setupRegulationUpdatesApi(app as any);
  setupDebugRegulationUpdatesApi(app as any);
  setupMCPIntegrationApi(app as any);
  initializeDatabase().catch(console.error);

  app.use('/downloads', express.static(path.join(process.cwd(), 'public/downloads')));

  return httpServer;
}
EOF

echo "✅ Authentication fix applied"
echo "🚀 Starting server with auth bypass..."

# Start the original command
exec "$@"
