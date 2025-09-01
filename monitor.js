#!/usr/bin/env node

/**
 * MCP Engine Process Monitor
 * Checks if the system is running and restarts if needed
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProcessMonitor {
  constructor() {
    this.checkInterval = 30000; // Check every 30 seconds
    this.ports = [3010, 3002, 3050]; // Critical ports to monitor
    this.isMonitoring = false;
  }

  async start() {
    console.log('🔍 Starting MCP Engine Process Monitor');
    console.log(`⏱️  Check Interval: ${this.checkInterval / 1000}s`);
    console.log(`🔌 Monitoring Ports: ${this.ports.join(', ')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.isMonitoring = true;
    this.monitor();
  }

  async monitor() {
    while (this.isMonitoring) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] 🔍 Performing health check...`);

      try {
        const healthStatus = await this.checkSystemHealth();
        
        if (healthStatus.allHealthy) {
          console.log(`[${timestamp}] ✅ All services healthy`);
        } else {
          console.log(`[${timestamp}] ⚠️ System unhealthy - attempting restart`);
          await this.restartSystem();
        }
      } catch (error) {
        console.error(`[${timestamp}] ❌ Health check failed:`, error.message);
        await this.restartSystem();
      }

      // Wait before next check
      await this.sleep(this.checkInterval);
    }
  }

  async checkSystemHealth() {
    const results = {
      allHealthy: true,
      services: {}
    };

    for (const port of this.ports) {
      try {
        const response = await fetch(`http://localhost:${port}/health`, {
          timeout: 5000
        });
        
        results.services[port] = response.ok;
        if (!response.ok) {
          results.allHealthy = false;
        }
      } catch (error) {
        // Try alternative endpoint for frontend
        if (port === 3050) {
          try {
            const response = await fetch(`http://localhost:${port}/`, {
              timeout: 5000
            });
            results.services[port] = response.ok;
            if (!response.ok) {
              results.allHealthy = false;
            }
          } catch (fallbackError) {
            results.services[port] = false;
            results.allHealthy = false;
          }
        } else {
          results.services[port] = false;
          results.allHealthy = false;
        }
      }
    }

    return results;
  }

  async restartSystem() {
    console.log('🔄 Restarting MCP Engine system...');
    
    try {
      // Kill existing processes
      await this.killExistingProcesses();
      
      // Wait a moment
      await this.sleep(3000);
      
      // Start resilient system
      const restartProcess = spawn('node', ['start-resilient.js'], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore'
      });
      
      restartProcess.unref();
      
      console.log('✅ System restart initiated');
      
      // Wait for services to start
      await this.sleep(15000);
      
    } catch (error) {
      console.error('❌ Failed to restart system:', error.message);
    }
  }

  async killExistingProcesses() {
    console.log('⏹️ Stopping existing processes...');
    
    try {
      // Kill npm processes
      spawn('pkill', ['-f', 'npm start'], { stdio: 'ignore' });
      await this.sleep(2000);
      
      // Kill node processes related to MCP
      spawn('pkill', ['-f', 'node.*mcp'], { stdio: 'ignore' });
      await this.sleep(2000);
      
      // Kill specific port processes if needed
      for (const port of this.ports) {
        spawn('lsof', ['-ti', `:${port}`], { stdio: 'pipe' })
          .stdout.on('data', (data) => {
            const pids = data.toString().trim().split('\n');
            pids.forEach(pid => {
              if (pid) {
                spawn('kill', ['-9', pid], { stdio: 'ignore' });
              }
            });
          });
      }
      
    } catch (error) {
      console.warn('Warning during process cleanup:', error.message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    console.log('🛑 Stopping process monitor...');
    this.isMonitoring = false;
  }
}

// Add fetch polyfill for Node.js
if (!globalThis.fetch) {
  const { default: fetch } = await import('node-fetch');
  globalThis.fetch = fetch;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Monitor shutdown requested');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Monitor shutdown requested');
  process.exit(0);
});

// Start the monitor
const monitor = new ProcessMonitor();
monitor.start().catch(error => {
  console.error('🚨 Failed to start process monitor:', error);
  process.exit(1);
});
