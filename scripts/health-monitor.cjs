#!/usr/bin/env node
/**
 * MCP Engine Health Monitor
 * 
 * Continuously monitors all services and auto-restarts if they go down.
 * Run with: node scripts/health-monitor.cjs
 * Or: npm run monitor
 */

const { spawn, exec } = require('child_process');
const http = require('http');

// Service definitions
const SERVICES = [
  {
    name: 'Registry API',
    port: 3010,
    healthUrl: 'http://localhost:3010/api/regulations/stats',
    startCmd: 'node start-registry-postgres.js',
    critical: true
  },
  {
    name: 'LLM Gateway',
    port: 3002,
    healthUrl: 'http://localhost:3002/api/llm/health',
    startCmd: 'node src/llm-gateway/start-llm-gateway-phase4.js',
    critical: true
  },
  {
    name: 'Delivery Server',
    port: 3051,
    healthUrl: 'http://localhost:3051/health',
    startCmd: 'node src/delivery/start-delivery-server.js',
    critical: false
  },
  {
    name: 'Frontend (Vite)',
    port: 3050,
    healthUrl: 'http://localhost:3050/',
    startCmd: 'npm run start:frontend',
    critical: false
  }
];

// State tracking
const serviceStatus = {};
const serviceProcesses = {};
let isShuttingDown = false;

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(msg, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors[color]}${msg}${colors.reset}`);
}

function clearLine() {
  process.stdout.write('\r\x1b[K');
}

/**
 * Check if a service is healthy
 */
async function checkHealth(service) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 3000);
    
    http.get(service.healthUrl, (res) => {
      clearTimeout(timeout);
      resolve(res.statusCode === 200);
    }).on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

/**
 * Check if port is in use
 */
async function isPortInUse(port) {
  return new Promise((resolve) => {
    exec(`lsof -i :${port} | grep LISTEN`, (error, stdout) => {
      resolve(stdout.trim().length > 0);
    });
  });
}

/**
 * Start a service
 */
async function startService(service) {
  if (serviceProcesses[service.name]) {
    return; // Already starting
  }
  
  log(`🚀 Starting ${service.name}...`, 'yellow');
  
  const [cmd, ...args] = service.startCmd.split(' ');
  const proc = spawn(cmd, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore'
  });
  
  proc.unref();
  serviceProcesses[service.name] = proc;
  
  // Wait for service to come up
  let attempts = 0;
  while (attempts < 10) {
    await new Promise(r => setTimeout(r, 1000));
    if (await checkHealth(service)) {
      log(`✅ ${service.name} started successfully`, 'green');
      delete serviceProcesses[service.name];
      return true;
    }
    attempts++;
  }
  
  log(`❌ ${service.name} failed to start after ${attempts} attempts`, 'red');
  delete serviceProcesses[service.name];
  return false;
}

/**
 * Print status dashboard
 */
function printDashboard() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║          MCP ENGINE HEALTH MONITOR                           ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╠══════════════════════════════════════════════════════════════╣${colors.reset}`);
  
  for (const service of SERVICES) {
    const status = serviceStatus[service.name];
    const icon = status === 'up' ? '🟢' : status === 'starting' ? '🟡' : '🔴';
    const statusText = status === 'up' ? 'RUNNING' : status === 'starting' ? 'STARTING' : 'DOWN';
    const statusColor = status === 'up' ? 'green' : status === 'starting' ? 'yellow' : 'red';
    const critical = service.critical ? '⚠️ ' : '  ';
    
    console.log(`${colors.cyan}║${colors.reset} ${icon} ${critical}${service.name.padEnd(20)} ${colors[statusColor]}${statusText.padEnd(10)}${colors.reset} :${service.port}     ${colors.cyan}║${colors.reset}`);
  }
  
  console.log(`${colors.bright}${colors.cyan}╠══════════════════════════════════════════════════════════════╣${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset} ${colors.gray}Auto-restart: ON  |  Check interval: 10s  |  Ctrl+C to exit${colors.reset} ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
}

/**
 * Main monitoring loop
 */
async function monitor() {
  // Initial check
  log('🔍 Checking service health...', 'cyan');
  
  for (const service of SERVICES) {
    const isHealthy = await checkHealth(service);
    serviceStatus[service.name] = isHealthy ? 'up' : 'down';
    
    if (!isHealthy && !isShuttingDown) {
      // Try to start the service
      serviceStatus[service.name] = 'starting';
      printDashboard();
      await startService(service);
      serviceStatus[service.name] = await checkHealth(service) ? 'up' : 'down';
    }
  }
  
  printDashboard();
  
  // Continuous monitoring
  setInterval(async () => {
    if (isShuttingDown) return;
    
    let changed = false;
    
    for (const service of SERVICES) {
      const wasUp = serviceStatus[service.name] === 'up';
      const isHealthy = await checkHealth(service);
      
      if (wasUp && !isHealthy) {
        log(`⚠️  ${service.name} went DOWN!`, 'red');
        serviceStatus[service.name] = 'starting';
        changed = true;
        printDashboard();
        
        // Auto-restart
        await startService(service);
        serviceStatus[service.name] = await checkHealth(service) ? 'up' : 'down';
        changed = true;
      } else if (!wasUp && isHealthy) {
        log(`✅ ${service.name} is now UP`, 'green');
        serviceStatus[service.name] = 'up';
        changed = true;
      }
    }
    
    if (changed) {
      printDashboard();
    }
  }, 10000); // Check every 10 seconds
}

// Graceful shutdown
process.on('SIGINT', () => {
  isShuttingDown = true;
  console.log('\n');
  log('👋 Shutting down health monitor...', 'yellow');
  process.exit(0);
});

// Start monitoring
console.log(`${colors.bright}${colors.cyan}MCP Engine Health Monitor${colors.reset}`);
console.log(`${colors.gray}Starting up...${colors.reset}\n`);

monitor().catch(err => {
  log(`Error: ${err.message}`, 'red');
  process.exit(1);
});
