import express from "express";
import { Server } from 'http';
import { createServer } from 'http';
import { log } from '../vite';
import { setupAuth } from '../auth';
import { setupRegulationUpdatesApi } from '../regulation-updates-api';
import { setupDebugRegulationUpdatesApi } from '../debug-regulation-updates';
import { setupMCPIntegrationApi } from '../mcp-integration-api';
import path from 'path';

// Import modular route handlers
import publicRoutes from './api/public';
import uploadsRoutes from './api/uploads';
import { regulationsRouter } from './api/regulations';
import { notesRouter } from './api/notes';

export function registerRoutes(app: express.Application): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // Serve static files from public directory for downloads
  app.use('/downloads', express.static(path.join(process.cwd(), 'public/downloads')));

  // Setup modular API routes
  app.use('/api/public', publicRoutes);
  app.use('/api/uploads', uploadsRoutes);
  
  // Mount authenticated routes
  app.use('/api/regulations', regulationsRouter);
  app.use('/api/notes', notesRouter);
  
  // Setup existing auth routes 
  setupAuth(app as any);
  
  // Setup regulation updates API routes
  setupRegulationUpdatesApi(app as any);
  
  // Setup MCP integration API routes
  setupMCPIntegrationApi(app as any);
  
  // Setup debug endpoints for regulation updates
  setupDebugRegulationUpdatesApi(app as any);

  // Test route to verify API handling
  app.get("/api/test", (req, res) => {
    res.json({ status: "ok", message: "API is working" });
  });

  return httpServer;
} 