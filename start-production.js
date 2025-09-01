#!/usr/bin/env node

/**
 * Production-Grade MCP Engine Startup Script
 * Designed for 24/7 operation with automatic restarts and health monitoring
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration for 24/7 operation
const CONFIG = {
  maxRestarts: 10,
  restartDelay: 5000, // 5 seconds
  healthCheckInterval: 30000, // 30 seconds
  services: [
    {
      name: 'Registry API',
      script: 'src/server/registry-api/registry-server.js',
      port: 3010,
      critical: true,
      maxMemory: '512MB'
    },
    {
      name: 'LLM Gateway',
      script: 'src/llm-gateway/start-llm-gateway-refactored.js',
      port: 3002,
      critical: true,
      maxMemory: '1GB'
    },
    {
      name: 'Delivery System',
      script: 'src/delivery-system/delivery-server.js',
      port: 3051,
      critical: false,
      maxMemory: '512MB'
    },
    {
      name: 'TUF Repository',
      script: 'src/delivery-system/tuf-repository/tuf-repository-server.js',
      port: 3052,
      critical: false,
      maxMemory: '256MB'
    },
    {
      name: 'Frontend',
      script: 'src/client/index.html',
      port: 3050,
      critical: true,
      isVite: true,
      maxMemory: '256MB'
    }
  ]
};

class ProductionManager {
  constructor() {
    this.services = new Map();
    this.restartCounts = new Map();
    this.isShuttingDown = false;
    this.startTime = new Date();
    
    // Setup graceful shutdown
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error);
      this.gracefulShutdown();
    });
  }

  async start() {
    console.log('🚀 Starting MCP Engine in Production Mode');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Start Time: ${this.startTime.toISOString()}`);
    console.log(`🔄 Max Restarts per Service: ${CONFIG.maxRestarts}`);
    console.log(`⏱️  Health Check Interval: ${CONFIG.healthCheckInterval / 1000}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Start services in order
    for (const serviceConfig of CONFIG.services) {
      await this.startService(serviceConfig);
      await this.sleep(2000); // Wait 2 seconds between service starts
    }

    // Start health monitoring
    this.startHealthMonitoring();

    console.log('✨ All services started successfully!');
    console.log('🔍 Health monitoring active');
    console.log('📝 Press Ctrl+C for graceful shutdown');
  }

  async startService(serviceConfig) {
    const { name, script, port, isVite, critical } = serviceConfig;
    
    console.log(`🔄 Starting ${name}...`);

    try {
      let childProcess;
      
      if (isVite) {
        // Start Vite dev server for frontend
        childProcess = spawn('npm', ['run', 'dev'], {
          cwd: path.join(__dirname, 'src/client'),
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
          env: {
            ...process.env,
            PORT: port.toString(),
            NODE_ENV: 'production'
          }
        });
      } else {
        // Start Node.js service
        childProcess = spawn('node', [script], {
          cwd: __dirname,
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
          env: {
            ...process.env,
            PORT: port.toString(),
            NODE_ENV: 'production'
          }
        });
      }

      // Store service info
      this.services.set(name, {
        process,
        config: serviceConfig,
        startTime: new Date(),
        restarts: 0
      });

      this.restartCounts.set(name, 0);

      // Handle process events
      process.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[${name}] ${output}`);
        }
      });

      process.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.error(`[${name}] ERROR: ${output}`);
        }
      });

      process.on('exit', (code, signal) => {
        console.log(`[${name}] Process exited with code ${code}, signal ${signal}`);
        
        if (!this.isShuttingDown) {
          if (critical) {
            console.error(`🚨 Critical service ${name} crashed! Attempting restart...`);
            this.restartService(name);
          } else {
            console.warn(`⚠️ Non-critical service ${name} crashed. Will restart on next health check.`);
          }
        }
      });

      // Wait for service to be ready
      await this.waitForService(port, name);
      console.log(`✅ ${name} started successfully on port ${port}`);

    } catch (error) {
      console.error(`❌ Failed to start ${name}:`, error.message);
      throw error;
    }
  }

  async restartService(serviceName) {
    const serviceInfo = this.services.get(serviceName);
    if (!serviceInfo) return;

    const restartCount = this.restartCounts.get(serviceName) || 0;
    
    if (restartCount >= CONFIG.maxRestarts) {
      console.error(`🚨 Service ${serviceName} has exceeded max restarts (${CONFIG.maxRestarts}). Giving up.`);
      return;
    }

    console.log(`🔄 Restarting ${serviceName} (attempt ${restartCount + 1}/${CONFIG.maxRestarts})`);
    
    // Kill existing process
    try {
      serviceInfo.process.kill('SIGTERM');
    } catch (error) {
      console.warn(`Warning: Could not kill ${serviceName} process:`, error.message);
    }

    // Wait before restart
    await this.sleep(CONFIG.restartDelay);

    // Increment restart count
    this.restartCounts.set(serviceName, restartCount + 1);

    // Start the service again
    try {
      await this.startService(serviceInfo.config);
    } catch (error) {
      console.error(`❌ Failed to restart ${serviceName}:`, error.message);
    }
  }

  startHealthMonitoring() {
    setInterval(async () => {
      if (this.isShuttingDown) return;

      console.log('🔍 Performing health check...');
      
      for (const [serviceName, serviceInfo] of this.services) {
        const { config } = serviceInfo;
        
        try {
          const isHealthy = await this.checkServiceHealth(config.port);
          
          if (!isHealthy) {
            console.warn(`⚠️ Health check failed for ${serviceName}`);
            
            if (config.critical) {
              console.log(`🔄 Restarting critical service ${serviceName}`);
              this.restartService(serviceName);
            }
          } else {
            console.log(`✅ ${serviceName} is healthy`);
          }
        } catch (error) {
          console.error(`❌ Health check error for ${serviceName}:`, error.message);
        }
      }
      
      this.printStatus();
    }, CONFIG.healthCheckInterval);
  }

  async checkServiceHealth(port) {
    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      // Try alternative health check endpoints
      try {
        const response = await fetch(`http://localhost:${port}/`, {
          timeout: 5000
        });
        return response.ok;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  printStatus() {
    const uptime = Math.floor((new Date() - this.startTime) / 1000);
    const uptimeStr = this.formatUptime(uptime);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 System Status - Uptime: ${uptimeStr}`);
    
    for (const [serviceName, serviceInfo] of this.services) {
      const restarts = this.restartCounts.get(serviceName) || 0;
      const serviceUptime = Math.floor((new Date() - serviceInfo.startTime) / 1000);
      const serviceUptimeStr = this.formatUptime(serviceUptime);
      
      console.log(`   ${serviceName}: Running (${serviceUptimeStr}, ${restarts} restarts)`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  async waitForService(port, serviceName, maxWait = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) return true;
      } catch (error) {
        // Try alternative endpoint
        try {
          const response = await fetch(`http://localhost:${port}/`);
          if (response.ok) return true;
        } catch (fallbackError) {
          // Service not ready yet
        }
      }
      
      await this.sleep(1000);
    }
    
    throw new Error(`Service ${serviceName} did not become ready within ${maxWait}ms`);
  }

  async gracefulShutdown() {
    if (this.isShuttingDown) return;
    
    console.log('\n🛑 Graceful shutdown initiated...');
    this.isShuttingDown = true;

    // Stop all services
    for (const [serviceName, serviceInfo] of this.services) {
      console.log(`⏹️ Stopping ${serviceName}...`);
      
      try {
        serviceInfo.process.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await this.sleep(2000);
        
        // Force kill if still running
        if (!serviceInfo.process.killed) {
          serviceInfo.process.kill('SIGKILL');
        }
        
        console.log(`✅ ${serviceName} stopped`);
      } catch (error) {
        console.error(`❌ Error stopping ${serviceName}:`, error.message);
      }
    }

    const totalUptime = Math.floor((new Date() - this.startTime) / 1000);
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total Uptime: ${this.formatUptime(totalUptime)}`);
    console.log(`   Services Managed: ${this.services.size}`);
    console.log(`   Total Restarts: ${Array.from(this.restartCounts.values()).reduce((a, b) => a + b, 0)}`);
    console.log('\n✅ Shutdown complete');
    
    process.exit(0);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Add fetch polyfill for Node.js
if (!globalThis.fetch) {
  const { default: fetch } = await import('node-fetch');
  globalThis.fetch = fetch;
}

// Start the production manager
const manager = new ProductionManager();
manager.start().catch(error => {
  console.error('🚨 Failed to start MCP Engine:', error);
  process.exit(1);
});
