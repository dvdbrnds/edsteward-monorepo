#!/usr/bin/env node

/**
 * MCP Engine Crash Monitor
 * Monitors all MCP Engine processes and logs when they crash
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';

const SERVICES = {
  'mcp-start': { pattern: 'mcp-start.js', port: null },
  'registry': { pattern: 'registry-server.js', port: 3010 },
  'llm-gateway': { pattern: 'simple-usc-gateway.js', port: 3002 },
  'delivery': { pattern: 'delivery-server.js', port: 3051 },
  'frontend': { pattern: 'vite.*3050', port: 3050 }
};

let previousProcesses = new Map();
let crashLog = [];

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Write to crash log file
  fs.appendFileSync('crash-monitor.log', logMessage + '\n');
}

function getCurrentProcesses() {
  const processes = new Map();
  
  for (const [serviceName, config] of Object.entries(SERVICES)) {
    try {
      const result = execSync(`ps aux | grep -E "${config.pattern}" | grep -v grep | grep -v monitor-crashes`, { encoding: 'utf8' });
      const lines = result.trim().split('\n').filter(line => line.length > 0);
      
      if (lines.length > 0) {
        const pids = lines.map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[1]; // PID is second column
        });
        processes.set(serviceName, pids);
      } else {
        processes.set(serviceName, []);
      }
    } catch (error) {
      processes.set(serviceName, []);
    }
  }
  
  return processes;
}

function checkPortHealth() {
  const healthResults = {};
  
  for (const [serviceName, config] of Object.entries(SERVICES)) {
    if (!config.port) continue;
    
    try {
      const result = execSync(`curl -s http://localhost:${config.port}/health --max-time 2 || curl -s http://localhost:${config.port} --max-time 2`, { encoding: 'utf8' });
      healthResults[serviceName] = result.length > 0 ? 'healthy' : 'unhealthy';
    } catch (error) {
      healthResults[serviceName] = 'unreachable';
    }
  }
  
  return healthResults;
}

function detectCrashes(current, previous) {
  const crashes = [];
  
  for (const [serviceName, currentPids] of current.entries()) {
    const previousPids = previous.get(serviceName) || [];
    
    // Check if all previous PIDs are gone
    const survivingPids = currentPids.filter(pid => previousPids.includes(pid));
    const crashedPids = previousPids.filter(pid => !currentPids.includes(pid));
    
    if (crashedPids.length > 0) {
      crashes.push({
        service: serviceName,
        crashedPids,
        survivingPids,
        newPids: currentPids.filter(pid => !previousPids.includes(pid))
      });
    }
  }
  
  return crashes;
}

function monitorLoop() {
  const currentProcesses = getCurrentProcesses();
  const healthStatus = checkPortHealth();
  
  // Detect crashes
  if (previousProcesses.size > 0) {
    const crashes = detectCrashes(currentProcesses, previousProcesses);
    
    if (crashes.length > 0) {
      log('🚨 CRASH DETECTED!');
      crashes.forEach(crash => {
        log(`  Service: ${crash.service}`);
        log(`  Crashed PIDs: ${crash.crashedPids.join(', ')}`);
        log(`  Surviving PIDs: ${crash.survivingPids.join(', ')}`);
        log(`  New PIDs: ${crash.newPids.join(', ')}`);
        
        crashLog.push({
          timestamp: new Date().toISOString(),
          service: crash.service,
          crashedPids: crash.crashedPids,
          newPids: crash.newPids
        });
      });
    }
  }
  
  // Log current status
  const statusSummary = [];
  for (const [serviceName, pids] of currentProcesses.entries()) {
    const health = healthStatus[serviceName] || 'n/a';
    statusSummary.push(`${serviceName}:${pids.length}pids(${health})`);
  }
  
  log(`Status: ${statusSummary.join(' | ')}`);
  
  previousProcesses = currentProcesses;
}

// Start monitoring
log('🔍 Starting MCP Engine Crash Monitor...');
log('Monitoring services: ' + Object.keys(SERVICES).join(', '));

// Initial check
monitorLoop();

// Monitor every 5 seconds
setInterval(monitorLoop, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  log('🛑 Crash monitor shutting down...');
  log(`Total crashes detected: ${crashLog.length}`);
  if (crashLog.length > 0) {
    log('Crash summary:');
    crashLog.forEach(crash => {
      log(`  ${crash.timestamp}: ${crash.service} (PIDs: ${crash.crashedPids.join(', ')})`);
    });
  }
  process.exit(0);
});




