#!/usr/bin/env node

/**
 * MCP Engine - Unified Startup Script
 * 
 * This script starts all components of the MCP Engine in the correct order:
 * 1. Registry API Server (regulation data management)
 * 2. LLM Gateway (AI processing)
 * 3. Frontend Development Server (React UI)
 * 
 * Features:
 * - Automatic dependency installation
 * - Port conflict resolution
 * - Health check verification
 * - Graceful shutdown handling
 * - Real-time status monitoring
 */

import { spawn, execSync } from 'child_process';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { existsSync } from 'fs';

// Configuration
const CONFIG = {
  ports: {
    registry: 3010,
    llmGateway: 3002,
    frontend: 3050,
    delivery: 3051,
    customerManagement: 3060,
    inquisitor: 3061
  },
  healthCheck: {
    maxRetries: 15,
    retryDelay: 1000,
    timeout: 30000
  },
  startup: {
    processTimeout: 60000,
    dependencyCheckTimeout: 30000
  }
};

// Process tracking
const processes = new Map();
const restartCounts = new Map();
const MAX_RESTARTS = 5;
const RESTART_WINDOW = 300000; // 5 minutes
let isShuttingDown = false;

// Logging utilities
const log = {
  info: (msg, service = 'MAIN') => console.log(`[${new Date().toLocaleTimeString()}] [${service}] ${msg}`),
  error: (msg, service = 'MAIN') => console.error(`[${new Date().toLocaleTimeString()}] [${service}] ERROR: ${msg}`),
  success: (msg, service = 'MAIN') => console.log(`[${new Date().toLocaleTimeString()}] [${service}] ✅ ${msg}`),
  warn: (msg, service = 'MAIN') => console.log(`[${new Date().toLocaleTimeString()}] [${service}] ⚠️  ${msg}`)
};

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if service can be restarted
 */
function canRestart(serviceName) {
  const now = Date.now();
  const restartData = restartCounts.get(serviceName) || { count: 0, firstRestart: now };
  
  // Reset count if restart window has passed
  if (now - restartData.firstRestart > RESTART_WINDOW) {
    restartData.count = 0;
    restartData.firstRestart = now;
  }
  
  if (restartData.count >= MAX_RESTARTS) {
    log.error(`Service ${serviceName} has reached maximum restart limit (${MAX_RESTARTS})`, serviceName);
    return false;
  }
  
  restartData.count++;
  restartCounts.set(serviceName, restartData);
  log.info(`Restart attempt ${restartData.count}/${MAX_RESTARTS} for ${serviceName}`, serviceName);
  return true;
}

/**
 * Kill processes using specific ports
 */
async function killProcessOnPort(port) {
  try {
    const stdout = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
    if (stdout) {
      const pids = stdout.split('\n').filter(Boolean);
      log.warn(`Killing processes on port ${port}: ${pids.join(', ')}`);
      
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`);
          log.info(`Killed PID ${pid} on port ${port}`);
        } catch (e) {
          log.warn(`Failed to kill PID ${pid}: ${e.message}`);
        }
      }
      await sleep(1000); // Allow port to be released
    }
  } catch (e) {
    // No process found, which is fine
    log.info(`No processes found on port ${port}`);
  }
}

/**
 * Check if dependencies are installed in a directory
 */
function ensureDependencies(dir, name) {
  if (!existsSync(path.join(dir, 'node_modules'))) {
    log.info(`Installing dependencies for ${name}...`);
    execSync('npm install', { cwd: dir, stdio: 'inherit' });
    log.success(`Dependencies installed for ${name}`);
  } else {
    log.info(`Dependencies already installed for ${name}`);
  }
}

/**
 * Wait for a service to be healthy
 */
async function waitForHealth(url, serviceName, maxRetries = CONFIG.healthCheck.maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      log.info(`Health check ${i + 1}/${maxRetries} for ${serviceName}...`);
      await axios.get(url, { timeout: 5000 });
      log.success(`${serviceName} is healthy!`);
      return true;
    } catch (error) {
      if (i === maxRetries - 1) {
        log.error(`${serviceName} failed health check after ${maxRetries} attempts`);
        return false;
      }
      await sleep(CONFIG.healthCheck.retryDelay);
    }
  }
  return false;
}

/**
 * Start Registry API Server (PostgreSQL)
 */
async function startRegistryServer() {
  log.info('Starting Registry API Server (PostgreSQL)...', 'REGISTRY');
  
  // Use PostgreSQL-backed registry server (deprecated CSV version)
  const registryProcess = spawn('node', ['start-registry-postgres.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  processes.set('registry', registryProcess);
  log.info(`Registry Server PID: ${registryProcess.pid}`, 'REGISTRY');

  registryProcess.stdout.on('data', (data) => {
    log.info(data.toString().trim(), 'REGISTRY');
  });

  registryProcess.stderr.on('data', (data) => {
    log.error(data.toString().trim(), 'REGISTRY');
  });

  registryProcess.on('close', (code) => {
    if (!isShuttingDown) {
      log.error(`Registry server exited with code ${code}`, 'REGISTRY');
      if (canRestart('registry')) {
        setTimeout(() => {
          if (!isShuttingDown) {
            startRegistryServer();
          }
        }, 2000);
      } else {
        log.error('Registry server restart limit reached, system will continue without it', 'REGISTRY');
      }
    }
  });

  // Wait for registry to be healthy
  const isHealthy = await waitForHealth(
    `http://localhost:${CONFIG.ports.registry}/health`,
    'Registry API'
  );

  if (!isHealthy) {
    throw new Error('Registry API failed to start');
  }

  return registryProcess;
}

/**
 * Start LLM Gateway
 */
async function startLLMGateway() {
  log.info('Starting LLM Gateway...', 'LLM');

  const llmProcess = spawn('node', ['src/llm-gateway/start-llm-gateway-phase4.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  processes.set('llm', llmProcess);
  log.info(`LLM Gateway PID: ${llmProcess.pid}`, 'LLM');

  llmProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    log.info(output, 'LLM');
    
    if (output.includes('Server running on')) {
      const match = output.match(/Server running on.*?(\d+)/);
      if (match) {
        log.success(`LLM Gateway available at http://localhost:${match[1]}`, 'LLM');
      }
    }
  });

  llmProcess.stderr.on('data', (data) => {
    log.error(data.toString().trim(), 'LLM');
  });

  llmProcess.on('close', (code) => {
    if (!isShuttingDown) {
      log.error(`LLM Gateway exited with code ${code}`, 'LLM');
      if (canRestart('llm')) {
        setTimeout(() => {
          if (!isShuttingDown) {
            startLLMGateway();
          }
        }, 2000);
      } else {
        log.error('LLM Gateway restart limit reached, system will continue without it', 'LLM');
      }
    }
  });

  // Wait for LLM Gateway to be healthy
  const isHealthy = await waitForHealth(
    `http://localhost:${CONFIG.ports.llmGateway}/api/llm/health`,
    'LLM Gateway'
  );

  if (!isHealthy) {
    log.warn('LLM Gateway health check failed, but continuing...', 'LLM');
  }

  return llmProcess;
}

/**
 * Start Delivery System
 */
async function startDeliverySystem() {
  log.info('Starting Delivery System...', 'DELIVERY');

  const deliveryProcess = spawn('node', ['src/delivery-system/delivery-server.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  deliveryProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log.info(output, 'DELIVERY');
    }
  });

  deliveryProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log.error(output, 'DELIVERY');
    }
  });

  deliveryProcess.on('close', (code) => {
    if (!isShuttingDown) {
      log.error(`Delivery System exited with code ${code}`, 'DELIVERY');
      if (canRestart('delivery')) {
        setTimeout(() => {
          if (!isShuttingDown) {
            startDeliverySystem();
          }
        }, 2000);
      } else {
        log.error('Delivery System restart limit reached, system will continue without it', 'DELIVERY');
      }
    }
  });

  processes.set('delivery', deliveryProcess);
  log.info(`Delivery System PID: ${deliveryProcess.pid}`, 'DELIVERY');

  // Give delivery system time to start
  await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * Start Customer Management API
 */
async function startCustomerManagement() {
  log.info('Starting Customer Management API...', 'CUSTOMER');

  const customerProcess = spawn('node', ['src/server/customer-management-api.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  customerProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log.info(output, 'CUSTOMER');
    }
  });

  customerProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log.error(output, 'CUSTOMER');
    }
  });

  customerProcess.on('close', (code) => {
    if (!isShuttingDown) {
      log.error(`Customer Management API exited with code ${code}`, 'CUSTOMER');
      if (canRestart('customer')) {
        setTimeout(() => {
          if (!isShuttingDown) {
            startCustomerManagement();
          }
        }, 2000);
      } else {
        log.error('Customer Management API restart limit reached, system will continue without it', 'CUSTOMER');
      }
    }
  });

  processes.set('customer', customerProcess);
  log.info(`Customer Management API PID: ${customerProcess.pid}`, 'CUSTOMER');

  return customerProcess;
}

/**
 * Start Inquisitor AI Auditor
 */
async function startInquisitor() {
  log.info('Starting Inquisitor AI Auditor...', 'INQUISITOR');

  const inquisitorProcess = spawn('node', ['src/inquisitor-mcp/inquisitor-server.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  inquisitorProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log.info(output, 'INQUISITOR');
    }
  });

  inquisitorProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log.error(output, 'INQUISITOR');
    }
  });

  inquisitorProcess.on('close', (code) => {
    if (!isShuttingDown) {
      log.error(`Inquisitor exited with code ${code}`, 'INQUISITOR');
      if (canRestart('inquisitor')) {
        setTimeout(() => {
          if (!isShuttingDown) {
            startInquisitor();
          }
        }, 2000);
      } else {
        log.error('Inquisitor restart limit reached, system will continue without it', 'INQUISITOR');
      }
    }
  });

  processes.set('inquisitor', inquisitorProcess);
  log.info(`Inquisitor PID: ${inquisitorProcess.pid}`, 'INQUISITOR');

  return inquisitorProcess;
}

/**
 * Start Frontend Development Server
 */
async function startFrontend() {
  log.info('Starting Frontend Development Server...', 'FRONTEND');

  const frontendProcess = spawn('npx', ['vite', '--port', CONFIG.ports.frontend.toString(), '--host'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  processes.set('frontend', frontendProcess);
  log.info(`Frontend Server PID: ${frontendProcess.pid}`, 'FRONTEND');

  frontendProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    log.info(output, 'FRONTEND');
    
    if (output.includes('Local:')) {
      const match = output.match(/Local:\s*(http:\/\/[^\s]+)/);
      if (match) {
        log.success(`Frontend available at ${match[1]}`, 'FRONTEND');
      }
    }
  });

  frontendProcess.stderr.on('data', (data) => {
    log.error(data.toString().trim(), 'FRONTEND');
  });

  frontendProcess.on('close', (code) => {
    if (!isShuttingDown) {
      log.error(`Frontend server exited with code ${code}`, 'FRONTEND');
      if (canRestart('frontend')) {
        setTimeout(() => {
          if (!isShuttingDown) {
            startFrontendServer();
          }
        }, 2000);
      } else {
        log.error('Frontend server restart limit reached, system will continue without it', 'FRONTEND');
      }
    }
  });

  // Give frontend time to start
  await sleep(3000);

  return frontendProcess;
}

/**
 * Upload test regulations to registry
 */
async function uploadTestRegulations() {
  try {
    log.info('Uploading test regulations...', 'REGISTRY');
    execSync('node upload-test-regulations.js', { stdio: 'pipe' });
    log.success('Test regulations uploaded', 'REGISTRY');
  } catch (error) {
    log.warn('Failed to upload test regulations, continuing...', 'REGISTRY');
  }
}

/**
 * Graceful shutdown
 */
function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info('Shutting down all services...');

  for (const [name, process] of processes) {
    try {
      log.info(`Stopping ${name}...`);
      process.kill('SIGTERM');
      
      // Give process time to shut down gracefully
      setTimeout(() => {
        if (!process.killed) {
          log.warn(`Force killing ${name}...`);
          process.kill('SIGKILL');
        }
      }, 5000);
    } catch (error) {
      log.error(`Error stopping ${name}: ${error.message}`);
    }
  }

  setTimeout(() => {
    log.info('Shutdown complete');
    process.exit(exitCode);
  }, 6000);
}

/**
 * Main startup sequence
 */
async function main() {
  try {
    // Display startup banner
    console.log('\n🚀 MCP Engine - Starting All Services\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Model Context Protocol Engine - Enterprise Compliance Platform');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Cleanup any existing processes
    log.info('Cleaning up existing processes...');
    try {
      execSync('pkill -f "node.*start-all.js" || true', { stdio: 'ignore' });
      execSync('pkill -f "vite.*3050" || true', { stdio: 'ignore' });
      execSync('pkill -f "registry-server.js" || true', { stdio: 'ignore' });
      execSync('pkill -f "start-llm-gateway-phase4" || true', { stdio: 'ignore' });
      execSync('pkill -f "delivery-server.js" || true', { stdio: 'ignore' });
      execSync('pkill -f "customer-management-api.js" || true', { stdio: 'ignore' });
    } catch (e) {
      // Ignore cleanup errors
    }

    // Step 2: Kill processes on required ports
    log.info('Releasing required ports...');
    await Promise.all([
      killProcessOnPort(CONFIG.ports.registry),
      killProcessOnPort(CONFIG.ports.llmGateway),
      killProcessOnPort(CONFIG.ports.frontend)
    ]);

    // Step 3: Ensure dependencies are installed
    log.info('Checking dependencies...');
    ensureDependencies(process.cwd(), 'root project');
    ensureDependencies(path.join(process.cwd(), 'src/client'), 'frontend');

    // Step 4: Start services in order
    log.info('Starting services...\n');

    // Start Registry API (core data management)
    await startRegistryServer();
    await uploadTestRegulations();

    // Start LLM Gateway (AI processing)
    await startLLMGateway();

    // Start Delivery System (regulation updates & real-time)
    await startDeliverySystem();

    // Start Customer Management API (customer data & delivery)
    await startCustomerManagement();

    // Start Inquisitor AI Auditor
    await startInquisitor();

    // Start Frontend (user interface)
    await startFrontend();

    // Success summary
    console.log('\n🎉 MCP Engine Successfully Started!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Registry API:     http://localhost:' + CONFIG.ports.registry);
    console.log('🤖 LLM Gateway:      http://localhost:' + CONFIG.ports.llmGateway);
    console.log('🚀 Delivery System:  http://localhost:' + CONFIG.ports.delivery);
    console.log('👥 Customer API:     http://localhost:' + CONFIG.ports.customerManagement);
    console.log('🌐 Frontend:         http://localhost:' + CONFIG.ports.frontend);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ All services are ready for compliance management!');
    console.log('📝 Press Ctrl+C to gracefully stop all services\n');

    // Keep the main process alive
    process.stdin.resume();

  } catch (error) {
    log.error(`Startup failed: ${error.message}`);
    shutdown(1);
  }
}

// Signal handlers for graceful shutdown
process.on('SIGINT', () => {
  log.info('Received SIGINT, shutting down gracefully...');
  shutdown(0);
});

process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down gracefully...');
  shutdown(0);
});

process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`);
  shutdown(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  shutdown(1);
});

// Start the application
main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  shutdown(1);
}); 