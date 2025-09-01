#!/usr/bin/env node
/**
 * MCP Engine Process Manager
 * Provides resilient process management with auto-restart, health monitoring, and graceful shutdown
 */
import { spawn } from 'child_process';
import { setupLogger } from '../utils/logger.js';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

const logger = setupLogger('process-manager');

export class ProcessManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.processes = new Map();
    this.healthChecks = new Map();
    this.restartAttempts = new Map();
    this.maxRestartAttempts = options.maxRestartAttempts || 5;
    this.restartDelay = options.restartDelay || 5000;
    this.healthCheckInterval = options.healthCheckInterval || 30000;
    this.isShuttingDown = false;
    
    // Service definitions
    this.services = [
      {
        name: 'registry-api',
        command: 'node',
        args: ['src/server/registry-api/registry-server.js'],
        port: 3010,
        healthEndpoint: 'http://localhost:3010/health',
        critical: true,
        restartOnFailure: true
      },
      {
        name: 'llm-gateway',
        command: 'node',
        args: ['src/llm-gateway/start-llm-gateway-refactored.js'],
        port: 3002,
        healthEndpoint: 'http://localhost:3002/health',
        critical: true,
        restartOnFailure: true
      },
      {
        name: 'websocket-service',
        command: 'node',
        args: ['src/websocket-service/start-websocket-service.js'],
        port: 3003,
        healthEndpoint: null, // WebSocket doesn't have HTTP health endpoint
        critical: true,
        restartOnFailure: true
      },
      {
        name: 'delivery-system',
        command: 'node',
        args: ['src/delivery-system/delivery-server.js'],
        port: 3051,
        healthEndpoint: 'http://localhost:3051/health',
        critical: false,
        restartOnFailure: true
      },
      {
        name: 'tuf-repository',
        command: 'node',
        args: ['src/delivery-system/tuf-repository/tuf-repository-server.js'],
        port: 3052,
        healthEndpoint: 'http://localhost:3052/health',
        critical: false,
        restartOnFailure: true
      },
      {
        name: 'frontend',
        command: 'npm',
        args: ['exec', 'vite', '--port', '3050', '--host'],
        port: 3050,
        healthEndpoint: 'http://localhost:3050',
        critical: false,
        restartOnFailure: true
      }
    ];
    
    this.setupSignalHandlers();
    this.startHealthMonitoring();
  }

  /**
   * Start all services
   */
  async startAll() {
    logger.info('🚀 Starting MCP Engine Process Manager...');
    
    for (const service of this.services) {
      try {
        await this.startService(service);
        // Stagger service starts to avoid port conflicts
        await this.sleep(2000);
      } catch (error) {
        logger.error(`Failed to start ${service.name}:`, error.message);
        if (service.critical) {
          logger.error('Critical service failed to start, aborting...');
          await this.stopAll();
          process.exit(1);
        }
      }
    }
    
    logger.info('✅ All services started successfully');
    this.emit('all-started');
  }

  /**
   * Start a single service
   */
  async startService(service) {
    if (this.processes.has(service.name)) {
      logger.warn(`Service ${service.name} is already running`);
      return;
    }

    logger.info(`🔄 Starting ${service.name}...`);
    
    const childProcess = spawn(service.command, service.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      cwd: process.cwd()
    });

    // Store process info
    this.processes.set(service.name, {
      process: childProcess,
      service,
      startTime: Date.now(),
      restarts: 0
    });

    // Reset restart attempts on successful start
    this.restartAttempts.set(service.name, 0);

    // Handle process events
    childProcess.on('exit', (code, signal) => {
      logger.warn(`Service ${service.name} exited with code ${code}, signal ${signal}`);
      this.processes.delete(service.name);
      
      if (!this.isShuttingDown && service.restartOnFailure) {
        this.scheduleRestart(service);
      }
    });

    childProcess.on('error', (error) => {
      logger.error(`Service ${service.name} error:`, error.message);
    });

    // Log output
    childProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.info(`[${service.name}] ${output}`);
      }
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.error(`[${service.name}] ${output}`);
      }
    });

    // Wait for service to be ready
    if (service.healthEndpoint) {
      await this.waitForHealth(service);
    } else {
      // For services without health endpoints, wait a bit
      await this.sleep(3000);
    }

    logger.info(`✅ Service ${service.name} started successfully (PID: ${childProcess.pid})`);
    this.emit('service-started', service.name);
  }

  /**
   * Wait for service health check to pass
   */
  async waitForHealth(service, maxAttempts = 30) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(service.healthEndpoint, {
          timeout: 5000
        });
        
        if (response.ok) {
          logger.info(`✅ Health check passed for ${service.name}`);
          return;
        }
      } catch (error) {
        // Health check failed, continue waiting
      }
      
      logger.info(`⏳ Waiting for ${service.name} to be healthy (${attempt}/${maxAttempts})...`);
      await this.sleep(2000);
    }
    
    throw new Error(`Service ${service.name} failed health check after ${maxAttempts} attempts`);
  }

  /**
   * Schedule service restart
   */
  scheduleRestart(service) {
    const attempts = this.restartAttempts.get(service.name) || 0;
    
    if (attempts >= this.maxRestartAttempts) {
      logger.error(`Service ${service.name} exceeded max restart attempts (${this.maxRestartAttempts})`);
      
      if (service.critical) {
        logger.error('Critical service failed permanently, shutting down system...');
        this.stopAll().then(() => process.exit(1));
      }
      return;
    }

    this.restartAttempts.set(service.name, attempts + 1);
    
    logger.info(`⏰ Scheduling restart for ${service.name} in ${this.restartDelay}ms (attempt ${attempts + 1}/${this.maxRestartAttempts})`);
    
    setTimeout(async () => {
      if (!this.isShuttingDown) {
        try {
          await this.startService(service);
          logger.info(`🔄 Service ${service.name} restarted successfully`);
          this.emit('service-restarted', service.name);
        } catch (error) {
          logger.error(`Failed to restart ${service.name}:`, error.message);
          this.scheduleRestart(service);
        }
      }
    }, this.restartDelay);
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    const healthInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        clearInterval(healthInterval);
        return;
      }
      
      await this.performHealthChecks();
    }, this.healthCheckInterval);
    
    logger.info(`🏥 Health monitoring started (interval: ${this.healthCheckInterval}ms)`);
  }

  /**
   * Perform health checks on all services
   */
  async performHealthChecks() {
    for (const [serviceName, processInfo] of this.processes) {
      const { service } = processInfo;
      
      if (!service.healthEndpoint) continue;
      
      try {
        const response = await fetch(service.healthEndpoint, {
          timeout: 10000
        });
        
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }
        
        // Health check passed
        this.emit('health-check-passed', serviceName);
        
      } catch (error) {
        logger.warn(`Health check failed for ${serviceName}: ${error.message}`);
        this.emit('health-check-failed', serviceName);
        
        // If process is still running but health check fails, restart it
        if (processInfo.process && !processInfo.process.killed) {
          logger.warn(`Restarting unhealthy service: ${serviceName}`);
          await this.stopService(serviceName);
          this.scheduleRestart(service);
        }
      }
    }
  }

  /**
   * Stop a single service
   */
  async stopService(serviceName) {
    const processInfo = this.processes.get(serviceName);
    if (!processInfo) {
      logger.warn(`Service ${serviceName} is not running`);
      return;
    }

    logger.info(`🛑 Stopping ${serviceName}...`);
    
    const { process } = processInfo;
    
    // Try graceful shutdown first
    process.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await this.sleep(5000);
    
    // Force kill if still running
    if (!process.killed) {
      logger.warn(`Force killing ${serviceName}...`);
      process.kill('SIGKILL');
    }
    
    this.processes.delete(serviceName);
    logger.info(`✅ Service ${serviceName} stopped`);
    this.emit('service-stopped', serviceName);
  }

  /**
   * Stop all services
   */
  async stopAll() {
    this.isShuttingDown = true;
    logger.info('🛑 Stopping all services...');
    
    const stopPromises = Array.from(this.processes.keys()).map(serviceName => 
      this.stopService(serviceName)
    );
    
    await Promise.all(stopPromises);
    logger.info('✅ All services stopped');
    this.emit('all-stopped');
  }

  /**
   * Get system status
   */
  getStatus() {
    const status = {
      totalServices: this.services.length,
      runningServices: this.processes.size,
      services: {}
    };
    
    for (const service of this.services) {
      const processInfo = this.processes.get(service.name);
      status.services[service.name] = {
        running: !!processInfo,
        pid: processInfo?.process.pid,
        startTime: processInfo?.startTime,
        restarts: processInfo?.restarts || 0,
        port: service.port,
        critical: service.critical
      };
    }
    
    return status;
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const shutdown = async (signal) => {
      logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
      await this.stopAll();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    process.on('uncaughtException', async (error) => {
      logger.error('❌ Uncaught exception:', error.message);
      logger.error('Stack trace:', error.stack);
      await this.stopAll();
      process.exit(1);
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      await this.stopAll();
      process.exit(1);
    });
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start process manager if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new ProcessManager();
  
  manager.on('all-started', () => {
    logger.info('🎉 MCP Engine is fully operational!');
  });
  
  manager.on('service-restarted', (serviceName) => {
    logger.info(`🔄 Service ${serviceName} has been restarted`);
  });
  
  manager.startAll().catch((error) => {
    logger.error('❌ Failed to start process manager:', error.message);
    process.exit(1);
  });
}
