#!/usr/bin/env node
/**
 * MCP Engine System Monitor
 * Real-time monitoring dashboard for system health and performance
 */
import express from 'express';
import { ProcessManager } from './process-manager.js';
import { setupLogger } from '../utils/logger.js';
// Use built-in fetch (Node.js 18+)

const logger = setupLogger('system-monitor');

export class SystemMonitor {
  constructor(options = {}) {
    this.port = options.port || 3099;
    this.processManager = new ProcessManager();
    this.app = express();
    this.metrics = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      restarts: 0,
      healthChecks: {
        passed: 0,
        failed: 0
      }
    };
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static('public'));
    
    // Request counter
    this.app.use((req, res, next) => {
      this.metrics.requests++;
      next();
    });
  }

  setupRoutes() {
    // System status endpoint
    this.app.get('/api/system/status', (req, res) => {
      const status = this.processManager.getStatus();
      const uptime = Date.now() - this.metrics.startTime;
      
      res.json({
        ...status,
        uptime,
        metrics: this.metrics,
        timestamp: new Date().toISOString()
      });
    });

    // Health check endpoint
    this.app.get('/api/system/health', async (req, res) => {
      try {
        const healthResults = await this.performComprehensiveHealthCheck();
        res.json({
          status: 'healthy',
          checks: healthResults,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Service control endpoints
    this.app.post('/api/system/services/:name/restart', async (req, res) => {
      try {
        const serviceName = req.params.name;
        await this.processManager.stopService(serviceName);
        
        // Find service definition
        const service = this.processManager.services.find(s => s.name === serviceName);
        if (service) {
          await this.processManager.startService(service);
          res.json({ success: true, message: `Service ${serviceName} restarted` });
        } else {
          res.status(404).json({ error: 'Service not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/system/restart-all', async (req, res) => {
      try {
        await this.processManager.stopAll();
        await this.processManager.startAll();
        res.json({ success: true, message: 'All services restarted' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Metrics endpoint
    this.app.get('/api/system/metrics', (req, res) => {
      const uptime = Date.now() - this.metrics.startTime;
      const status = this.processManager.getStatus();
      
      res.json({
        uptime,
        metrics: this.metrics,
        services: status.services,
        timestamp: new Date().toISOString()
      });
    });

    // Dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
  }

  setupEventListeners() {
    this.processManager.on('service-restarted', () => {
      this.metrics.restarts++;
    });

    this.processManager.on('health-check-passed', () => {
      this.metrics.healthChecks.passed++;
    });

    this.processManager.on('health-check-failed', () => {
      this.metrics.healthChecks.failed++;
    });
  }

  async performComprehensiveHealthCheck() {
    const checks = {};
    const services = [
      { name: 'registry-api', url: 'http://localhost:3010/health' },
      { name: 'llm-gateway', url: 'http://localhost:3002/health' },
      { name: 'delivery-system', url: 'http://localhost:3051/health' },
      { name: 'tuf-repository', url: 'http://localhost:3052/health' },
      { name: 'frontend', url: 'http://localhost:3050' }
    ];

    for (const service of services) {
      try {
        const startTime = Date.now();
        const response = await fetch(service.url, { timeout: 5000 });
        const responseTime = Date.now() - startTime;
        
        checks[service.name] = {
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime,
          statusCode: response.status
        };
      } catch (error) {
        checks[service.name] = {
          status: 'unhealthy',
          error: error.message,
          responseTime: null
        };
      }
    }

    return checks;
  }

  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Engine System Monitor</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #3d1a5a; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-healthy { color: #28a745; }
        .status-unhealthy { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .service { padding: 10px; margin: 5px 0; border-left: 4px solid #ddd; background: #f8f9fa; }
        .service.healthy { border-left-color: #28a745; }
        .service.unhealthy { border-left-color: #dc3545; }
        .btn { background: #3d1a5a; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
        .btn:hover { background: #2d1442; }
        .refresh { text-align: right; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 MCP Engine System Monitor</h1>
            <p>Real-time monitoring and management dashboard</p>
        </div>
        
        <div class="refresh">
            <button class="btn" onclick="location.reload()">🔄 Refresh</button>
            <button class="btn" onclick="restartAll()">🔄 Restart All Services</button>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>📊 System Overview</h3>
                <div id="system-overview">Loading...</div>
            </div>
            
            <div class="card">
                <h3>🏥 Service Health</h3>
                <div id="service-health">Loading...</div>
            </div>
            
            <div class="card">
                <h3>📈 Metrics</h3>
                <div id="metrics">Loading...</div>
            </div>
            
            <div class="card">
                <h3>🔧 Service Control</h3>
                <div id="service-control">Loading...</div>
            </div>
        </div>
    </div>

    <script>
        async function loadSystemStatus() {
            try {
                const response = await fetch('/api/system/status');
                const data = await response.json();
                
                // System Overview
                document.getElementById('system-overview').innerHTML = \`
                    <div class="metric"><span>Total Services:</span><span>\${data.totalServices}</span></div>
                    <div class="metric"><span>Running Services:</span><span class="\${data.runningServices === data.totalServices ? 'status-healthy' : 'status-warning'}">\${data.runningServices}/\${data.totalServices}</span></div>
                    <div class="metric"><span>Uptime:</span><span>\${formatUptime(data.uptime)}</span></div>
                    <div class="metric"><span>Last Updated:</span><span>\${new Date(data.timestamp).toLocaleTimeString()}</span></div>
                \`;
                
                // Service Health
                let servicesHTML = '';
                for (const [name, service] of Object.entries(data.services)) {
                    const statusClass = service.running ? 'healthy' : 'unhealthy';
                    const statusText = service.running ? '✅ Running' : '❌ Stopped';
                    servicesHTML += \`
                        <div class="service \${statusClass}">
                            <strong>\${name}</strong> - \${statusText}
                            \${service.running ? \`<br><small>PID: \${service.pid} | Port: \${service.port} | Restarts: \${service.restarts}</small>\` : ''}
                        </div>
                    \`;
                }
                document.getElementById('service-health').innerHTML = servicesHTML;
                
                // Metrics
                document.getElementById('metrics').innerHTML = \`
                    <div class="metric"><span>Total Requests:</span><span>\${data.metrics.requests}</span></div>
                    <div class="metric"><span>Errors:</span><span>\${data.metrics.errors}</span></div>
                    <div class="metric"><span>Service Restarts:</span><span>\${data.metrics.restarts}</span></div>
                    <div class="metric"><span>Health Checks Passed:</span><span class="status-healthy">\${data.metrics.healthChecks.passed}</span></div>
                    <div class="metric"><span>Health Checks Failed:</span><span class="status-unhealthy">\${data.metrics.healthChecks.failed}</span></div>
                \`;
                
                // Service Control
                let controlHTML = '';
                for (const [name, service] of Object.entries(data.services)) {
                    controlHTML += \`
                        <div style="margin: 10px 0;">
                            <strong>\${name}</strong>
                            <button class="btn" onclick="restartService('\${name}')" style="margin-left: 10px;">🔄 Restart</button>
                        </div>
                    \`;
                }
                document.getElementById('service-control').innerHTML = controlHTML;
                
            } catch (error) {
                console.error('Failed to load system status:', error);
            }
        }
        
        function formatUptime(ms) {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) return \`\${days}d \${hours % 24}h \${minutes % 60}m\`;
            if (hours > 0) return \`\${hours}h \${minutes % 60}m\`;
            if (minutes > 0) return \`\${minutes}m \${seconds % 60}s\`;
            return \`\${seconds}s\`;
        }
        
        async function restartService(serviceName) {
            try {
                const response = await fetch(\`/api/system/services/\${serviceName}/restart\`, {
                    method: 'POST'
                });
                const result = await response.json();
                alert(result.message || result.error);
                setTimeout(loadSystemStatus, 2000);
            } catch (error) {
                alert('Failed to restart service: ' + error.message);
            }
        }
        
        async function restartAll() {
            if (confirm('Are you sure you want to restart all services?')) {
                try {
                    const response = await fetch('/api/system/restart-all', {
                        method: 'POST'
                    });
                    const result = await response.json();
                    alert(result.message || result.error);
                    setTimeout(loadSystemStatus, 5000);
                } catch (error) {
                    alert('Failed to restart services: ' + error.message);
                }
            }
        }
        
        // Load initial data
        loadSystemStatus();
        
        // Auto-refresh every 30 seconds
        setInterval(loadSystemStatus, 30000);
    </script>
</body>
</html>
    `;
  }

  async start() {
    // Start process manager first
    await this.processManager.startAll();
    
    // Start monitoring server
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          logger.info(`🖥️ System Monitor running on http://localhost:${this.port}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    if (this.server) {
      this.server.close();
    }
    await this.processManager.stopAll();
    logger.info('📴 System Monitor stopped');
  }
}

// Start system monitor if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new SystemMonitor();
  
  // Handle graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`🛑 Received ${signal}, shutting down...`);
    await monitor.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  monitor.start().catch((error) => {
    logger.error('❌ Failed to start system monitor:', error.message);
    process.exit(1);
  });
}
