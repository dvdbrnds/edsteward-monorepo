import { Server } from 'http';
import express from 'express';
import path from 'path';
import { config } from './config/environment';

// Declare server variable at module scope for proper cleanup
let server: Server | null = null;

export async function startServer(): Promise<Server> {
  console.log('=== EDSTEWARD FRONTEND-ONLY SERVER v2.0 ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', config.PORT);
  console.log('🎯 SERVING FRONTEND ONLY - NO DATABASE DEPENDENCIES');
  
  try {
    // Create minimal Express app
    const app = express();
    
    // Basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        mode: 'frontend-only' 
      });
    });
    
    // API fallback for frontend (returns mock data)
    app.get('/api/*', (req, res) => {
      res.json({ 
        message: 'API temporarily unavailable - frontend-only mode',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });
    
    // POST API fallback for login attempts
    app.post('/api/*', (req, res) => {
      res.status(503).json({ 
        error: 'Service Temporarily Unavailable',
        message: 'Backend services are temporarily disabled. Frontend-only mode active.',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });
    
    // Serve static files (production build) - fixed path
    const distPath = path.join(__dirname, '..', 'dist', 'public');
    console.log('Serving static files from:', distPath);
    app.use(express.static(distPath));
    
    // Catch-all handler for SPA routing
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      console.log('Serving index.html for route:', req.path);
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('Error serving index.html:', err);
          res.status(500).send('Error loading application');
        }
      });
    });

    // Start server
    console.log('Starting HTTP server on port', config.PORT);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        console.log('Cleaning up server...');
        if (server) {
          server.close();
          server = null;
        }
      };

      process.on('SIGTERM', cleanup);
      process.on('SIGINT', cleanup);

      server = app.listen(config.PORT, () => {
        console.log(`🚀 FRONTEND-ONLY SERVER RUNNING ON PORT ${config.PORT}!`);
        console.log(`Server accessible at http://localhost:${config.PORT}`);
        resolve(server!);
      });

      server.on('error', (error) => {
        console.error('❌ SERVER ERROR:', error);
        cleanup();
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ FAILED TO START SERVER:', error);
    throw error;
  }
} 