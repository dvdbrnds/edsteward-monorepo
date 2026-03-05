#!/usr/bin/env node

/**
 * MCP Engine - Stop Script
 * 
 * Gracefully shuts down all MCP Engine processes
 */

import { execSync } from 'child_process';

const PORTS = [3010, 3002, 3050];

const log = {
  info: (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`),
  success: (msg) => console.log(`[${new Date().toLocaleTimeString()}] ✅ ${msg}`),
  warn: (msg) => console.log(`[${new Date().toLocaleTimeString()}] ⚠️  ${msg}`)
};

/**
 * Kill processes on specific ports
 */
function killProcessOnPort(port) {
  try {
    const stdout = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
    if (stdout) {
      const pids = stdout.split('\n').filter(Boolean);
      log.info(`Stopping processes on port ${port}: ${pids.join(', ')}`);
      
      for (const pid of pids) {
        try {
          execSync(`kill -TERM ${pid}`);
          log.success(`Gracefully stopped PID ${pid} on port ${port}`);
        } catch (e) {
          try {
            execSync(`kill -9 ${pid}`);
            log.warn(`Force killed PID ${pid} on port ${port}`);
          } catch (e2) {
            log.warn(`Failed to kill PID ${pid}: ${e2.message}`);
          }
        }
      }
    } else {
      log.info(`No processes found on port ${port}`);
    }
  } catch (e) {
    log.info(`No processes found on port ${port}`);
  }
}

/**
 * Stop all MCP Engine processes
 */
function stopAll() {
  console.log('\n🛑 MCP Engine - Stopping All Services\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Stop processes by name pattern
  try {
    log.info('Stopping MCP Engine processes...');
    execSync('pkill -TERM -f "mcp-start.js" || true', { stdio: 'ignore' });
    execSync('pkill -TERM -f "start-all.js" || true', { stdio: 'ignore' });
    execSync('pkill -TERM -f "vite.*3050" || true', { stdio: 'ignore' });
    execSync('pkill -TERM -f "registry-server.js" || true', { stdio: 'ignore' });
    execSync('pkill -TERM -f "start-llm-gateway" || true', { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors
  }

  // Wait a moment for graceful shutdown
  setTimeout(() => {
    // Stop processes by port
    log.info('Releasing ports...');
    PORTS.forEach(port => killProcessOnPort(port));

    // Force kill any remaining processes
    try {
      execSync('pkill -9 -f "mcp-start.js" || true', { stdio: 'ignore' });
      execSync('pkill -9 -f "start-all.js" || true', { stdio: 'ignore' });
      execSync('pkill -9 -f "vite.*3050" || true', { stdio: 'ignore' });
      execSync('pkill -9 -f "registry-server.js" || true', { stdio: 'ignore' });
      execSync('pkill -9 -f "start-llm-gateway" || true', { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors
    }

    console.log('\n✅ All MCP Engine services have been stopped');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }, 3000);
}

stopAll(); 