/**
 * TUF Repository Server for MCP Engine Regulation Delivery
 * Serves TUF metadata and regulation files over HTTP/HTTPS
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs/promises';
import { TUFRepository } from './tuf-core.js';
import dotenv from 'dotenv';

dotenv.config();

export class TUFRepositoryServer {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || process.env.TUF_REPOSITORY_PORT || 3052;
    this.repository = new TUFRepository();
    this.repositoryPath = options.repositoryPath || './repository';
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static(this.repositoryPath));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        service: 'TUF Repository Server',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        repository: this.repository.getStatus()
      });
    });

    // Regenerate metadata (fix consistency issues)
    this.app.post('/admin/regenerate-metadata', async (req, res) => {
      try {
        console.log('🔄 Regenerating TUF metadata from actual files...');
        
        // Re-read all files and update metadata with correct sizes
        const regulationsDir = path.join(this.repositoryPath, 'targets', 'regulations');
        const files = await fs.readdir(regulationsDir);
        
        // Clear and rebuild targets
        this.repository.targetsRole.clearTargets();
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const regulationId = file.replace('.json', '');
            const filePath = path.join(regulationsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            
            console.log(`📋 Re-adding ${regulationId} (${Buffer.byteLength(content, 'utf8')} bytes)`);
            
            this.repository.addRegulationTarget(regulationId, content, {
              category: 'regenerated',
              priority: 'medium',
              source: 'Metadata Regeneration'
            });
          }
        }
        
        await this.updateAndPersistMetadata();
        
        res.json({
          message: 'Metadata regenerated successfully',
          filesProcessed: files.length
        });
        
      } catch (error) {
        console.error('❌ Regeneration failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // TUF Metadata endpoints
    this.app.get('/metadata/root.json', async (req, res) => {
      try {
        const metadata = await this.getSignedMetadata('root');
        res.json(metadata);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch root metadata' });
      }
    });

    this.app.get('/metadata/targets.json', async (req, res) => {
      try {
        const metadata = await this.getSignedMetadata('targets');
        res.json(metadata);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch targets metadata' });
      }
    });

    this.app.get('/metadata/snapshot.json', async (req, res) => {
      try {
        const metadata = await this.getSignedMetadata('snapshot');
        res.json(metadata);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch snapshot metadata' });
      }
    });

    this.app.get('/metadata/timestamp.json', async (req, res) => {
      try {
        const metadata = await this.getSignedMetadata('timestamp');
        res.json(metadata);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch timestamp metadata' });
      }
    });

    // Regulation file endpoints
    this.app.get('/targets/regulations/:regulationId.json', async (req, res) => {
      try {
        const { regulationId } = req.params;
        const fileContent = await this.getRegulationFile(regulationId);
        res.json(fileContent);
      } catch (error) {
        res.status(404).json({ error: 'Regulation file not found' });
      }
    });

    // Administrative endpoints
    this.app.post('/admin/initialize', async (req, res) => {
      try {
        const keys = await this.repository.initialize();
        await this.persistMetadata();
        res.json({
          message: 'Repository initialized successfully',
          keyIds: Object.fromEntries(
            Object.entries(keys).map(([role, data]) => [role, data.keyId])
          )
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/admin/add-regulation', async (req, res) => {
      try {
        const { regulationId, content, metadata } = req.body;
        
        if (!regulationId || !content) {
          return res.status(400).json({ 
            error: 'regulationId and content are required' 
          });
        }

        // Ensure consistent format for both TUF metadata and file storage
        const contentString = JSON.stringify(content, null, 2);
        
        const targetInfo = this.repository.addRegulationTarget(
          regulationId, 
          contentString, 
          metadata
        );

        await this.persistRegulationFile(regulationId, contentString);
        await this.updateAndPersistMetadata();
        
        // Notify clients of update
        this.notifyClients({
          type: 'regulation_updated',
          regulationId: regulationId,
          path: targetInfo.path,
          hash: targetInfo.hash,
          timestamp: new Date().toISOString()
        });

        res.json({
          message: 'Regulation added successfully',
          regulationId: regulationId,
          target: targetInfo
        });
      } catch (error) {
        console.error('Failed to add regulation:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/admin/status', (req, res) => {
      res.json({
        repository: this.repository.getStatus(),
        server: {
          port: this.port,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      });
    });

    // List available regulations
    this.app.get('/api/regulations', async (req, res) => {
      try {
        const metadata = await this.getSignedMetadata('targets');
        const regulations = Object.entries(metadata.signed.targets)
          .filter(([path]) => path.startsWith('regulations/'))
          .map(([path, info]) => ({
            regulationId: info.custom.regulationId,
            path: path,
            hash: info.hashes.sha256,
            length: info.length,
            updateTime: info.custom.updateTime,
            metadata: info.custom
          }));

        res.json({
          regulations: regulations,
          count: regulations.length,
          lastUpdate: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list regulations' });
      }
    });
  }

  setupWebSocket() {
    this.wss = new WebSocketServer({ port: this.port + 1 });
    
    this.wss.on('connection', (ws, req) => {
      console.log(`🔌 TUF WebSocket client connected from ${req.socket.remoteAddress}`);
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('📨 WebSocket message:', message);
          
          if (message.type === 'subscribe') {
            ws.subscribed = true;
            ws.send(JSON.stringify({
              type: 'subscription_confirmed',
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('📴 TUF WebSocket client disconnected');
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        service: 'TUF Repository Server',
        timestamp: new Date().toISOString()
      }));
    });

    console.log(`🔌 TUF WebSocket server listening on port ${this.port + 1}`);
  }

  notifyClients(message) {
    const clientCount = this.wss.clients.size;
    let notifiedCount = 0;

    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN && client.subscribed) {
        client.send(JSON.stringify(message));
        notifiedCount++;
      }
    });

    console.log(`📡 Notified ${notifiedCount}/${clientCount} TUF clients of update`);
  }

  async getSignedMetadata(role) {
    const allMetadata = await this.repository.updateMetadata();
    return allMetadata[role];
  }

  async getRegulationFile(regulationId) {
    const filePath = path.join(this.repositoryPath, 'targets', 'regulations', `${regulationId}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  async persistRegulationFile(regulationId, contentString) {
    const targetDir = path.join(this.repositoryPath, 'targets', 'regulations');
    const filePath = path.join(targetDir, `${regulationId}.json`);
    
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filePath, contentString, 'utf8');
    
    console.log(`💾 Persisted regulation file: ${regulationId} (${Buffer.byteLength(contentString, 'utf8')} bytes)`);
  }

  async updateAndPersistMetadata() {
    const metadata = await this.repository.updateMetadata();
    await this.persistMetadata(metadata);
    return metadata;
  }

  async persistMetadata(metadata = null) {
    if (!metadata) {
      metadata = await this.repository.updateMetadata();
    }

    const metadataDir = path.join(this.repositoryPath, 'metadata');
    await fs.mkdir(metadataDir, { recursive: true });

    // Write all metadata files
    for (const [role, data] of Object.entries(metadata)) {
      const filePath = path.join(metadataDir, `${role}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    console.log('💾 Persisted all TUF metadata files');
  }

  async ensureDirectories() {
    const dirs = [
      this.repositoryPath,
      path.join(this.repositoryPath, 'metadata'),
      path.join(this.repositoryPath, 'targets'),
      path.join(this.repositoryPath, 'targets', 'regulations')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async start() {
    await this.ensureDirectories();
    
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 TUF Repository Server started on port ${this.port}`);
        console.log(`📋 Repository path: ${this.repositoryPath}`);
        console.log(`🔌 WebSocket server on port ${this.port + 1}`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) {
      this.server.close();
    }
    if (this.wss) {
      this.wss.close();
    }
    console.log('🛑 TUF Repository Server stopped');
  }
}

// Direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new TUFRepositoryServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\\n🛑 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  server.start().catch(console.error);
}
