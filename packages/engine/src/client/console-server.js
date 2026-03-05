/**
 * Frontend Console Server
 * Serves dynamic regulation consoles on the frontend port
 */

import express from 'express';
import { ConsoleGenerator } from '../server/console-generator.js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FrontendConsoleServer {
  constructor() {
    this.app = express();
    this.port = 3055; // Use a different port to avoid conflicts
    this.consoleGenerator = new ConsoleGenerator();
    this.allRegulations = [];
    this.loadRegulations();
    this.setupRoutes();
  }

  loadRegulations() {
    try {
      const csvPath = path.join(process.cwd(), 'compmat.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      this.allRegulations = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      console.log(`✅ Frontend Console Server: Loaded ${this.allRegulations.length} regulations`);
    } catch (error) {
      console.error('❌ Failed to load regulations CSV:', error.message);
    }
  }

  setupRoutes() {
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Console route handler
    this.app.get('/console/:regulationId', (req, res) => {
      const regulationId = req.params.regulationId;
      
      try {
        // Find the regulation by ID or slug
        const regulation = this.allRegulations.find(reg => 
          reg['Item ID'] === regulationId || 
          this.consoleGenerator.getRegulationSlug(reg) === regulationId ||
          reg.id === regulationId
        );
        
        if (!regulation) {
          return res.status(404).send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>Regulation Not Found</h1>
                <p>Regulation with ID "${regulationId}" was not found.</p>
                <a href="http://localhost:3050/">Return to Dashboard</a>
              </body>
            </html>
          `);
        }
        
        // Generate the console HTML
        const consoleHtml = this.consoleGenerator.generateConsole(regulation);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(consoleHtml);
        
      } catch (error) {
        console.error('Error generating console:', error);
        res.status(500).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Console Generation Error</h1>
              <p>Failed to generate console: ${error.message}</p>
              <a href="http://localhost:3050/">Return to Dashboard</a>
            </body>
          </html>
        `);
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        regulations: this.allRegulations.length,
        timestamp: new Date().toISOString()
      });
    });
  }

  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`🎯 Frontend Console Server running on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('🛑 Frontend Console Server stopped');
    }
  }
}

export default FrontendConsoleServer;
