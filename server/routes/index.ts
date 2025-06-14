import express from "express";
import { Server } from 'http';
import { createServer } from 'http';
import { log } from '../vite';
import { setupAuth } from '../auth';
import { setupRegulationUpdatesApi } from '../regulation-updates-api';
import { setupDebugRegulationUpdatesApi } from '../debug-regulation-updates';
import { setupMCPIntegrationApi } from '../mcp-integration-api';
import { initializeDatabase } from '../db-init';
import path from 'path';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';

// Import modular route handlers
import publicRoutes from './api/public';
import uploadsRoutes from './api/uploads';
import { regulationsRouter } from './api/regulations';
import { notesRouter } from './api/notes';
// @ts-ignore
import migrationRoutes from './database-migration.js';

export function registerRoutes(app: express.Application): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // Serve static files from public directory for downloads
  app.use('/downloads', express.static(path.join(process.cwd(), 'public/downloads')));

  // Database initialization route (for production setup)
  app.get('/api/init-db', async (req, res) => {
    console.log('🔧 Database initialization endpoint called via GET');
    try {
      console.log('Current NODE_ENV:', process.env.NODE_ENV);
      
      const result = await initializeDatabase();
      console.log('✅ Database initialization successful:', result);
      res.json(result);
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      res.status(500).json({ 
        error: 'Database initialization failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/init-db', async (req, res) => {
    console.log('🔧 Database initialization endpoint called via POST');
    try {
      console.log('Current NODE_ENV:', process.env.NODE_ENV);
      
      const result = await initializeDatabase();
      console.log('✅ Database initialization successful:', result);
      res.json(result);
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      res.status(500).json({ 
        error: 'Database initialization failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Simple database initialization endpoint
  app.get('/api/init-db-simple', async (req, res) => {
    try {
      console.log('🚀 Manual database initialization requested...');
      
      // Import and run database initialization
      const { initializeDatabase } = await import('../db-init');
      const result = await initializeDatabase();
      
      console.log('✅ Database initialization completed:', result);
      res.json(result);
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Database initialization failed'
      });
    }
  });

  // Setup modular API routes
  app.use('/api/public', publicRoutes);
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/migration', migrationRoutes);
  
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

  // Simple health check for ALB (no database dependency)
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // Comprehensive health check with database status
  app.get("/api/health", async (req, res) => {
    try {
      console.log('Health check endpoint called');
      
      // Test database connection
      const dbResult = await db.execute(sql`SELECT NOW() as current_time`);
      console.log('Database connection test successful');
      
      // Check if users table exists and count users
      const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      console.log('User count query successful:', userCount.rows[0]);
      
      // Check if admin user exists
      const adminUser = await db.execute(sql`SELECT id, username, role FROM users WHERE username = 'admin'`);
      console.log('Admin user query result:', adminUser.rows);
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          currentTime: dbResult.rows[0].current_time,
          userCount: userCount.rows[0].count,
          adminUserExists: adminUser.rows.length > 0,
          adminUser: adminUser.rows[0] || null
        }
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        database: {
          connected: false
        }
      });
    }
  });

  return httpServer;
} 