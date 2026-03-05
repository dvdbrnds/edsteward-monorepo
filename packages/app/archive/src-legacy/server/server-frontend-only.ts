import { Server } from 'http';
import express from 'express';
import path from 'path';
import { config } from './config/environment';

// Declare server variable at module scope for proper cleanup
let server: Server | null = null;

export async function startServer(): Promise<Server> {
  
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
    app.use(express.static(distPath));
    
    // Catch-all handler for SPA routing
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('Error serving index.html:', err);
          res.status(500).send('Error loading application');
        }
      });
    });

    // Start server
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (server) {
          server.close();
          server = null;
        }
      };

      process.on('SIGTERM', cleanup);
      process.on('SIGINT', cleanup);

      server = app.listen(config.PORT, () => {
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