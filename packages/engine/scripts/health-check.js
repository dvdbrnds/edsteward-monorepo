#!/usr/bin/env node
/**
 * MCP Engine Health Check Script
 * External health monitoring for CI/CD, monitoring systems, and operational checks
 */
// Use built-in fetch (Node.js 18+)
import { setupLogger } from '../src/utils/logger.js';

const logger = setupLogger('health-check');

const SERVICES = [
  { name: 'Registry API', url: 'http://localhost:3010/health', critical: true },
  { name: 'LLM Gateway', url: 'http://localhost:3002/health', critical: true },
  { name: 'WebSocket Service', port: 3003, critical: true }, // Port check only
  { name: 'Delivery System', url: 'http://localhost:3051/health', critical: false },
  { name: 'TUF Repository', url: 'http://localhost:3052/health', critical: false },
  { name: 'Frontend', url: 'http://localhost:3050', critical: false },
  { name: 'System Monitor', url: 'http://localhost:3099/api/system/health', critical: false }
];

async function checkService(service) {
  const startTime = Date.now();
  
  try {
    if (service.port && !service.url) {
      // Port check for WebSocket service
      const net = await import('net');
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        
        socket.on('connect', () => {
          socket.destroy();
          resolve({
            name: service.name,
            status: 'healthy',
            responseTime: Date.now() - startTime,
            message: `Port ${service.port} is open`
          });
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          resolve({
            name: service.name,
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: `Port ${service.port} timeout`
          });
        });
        
        socket.on('error', (error) => {
          resolve({
            name: service.name,
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: error.message
          });
        });
        
        socket.connect(service.port, 'localhost');
      });
    } else {
      // HTTP health check
      const response = await fetch(service.url, {
        timeout: 10000,
        headers: { 'User-Agent': 'MCP-Engine-Health-Check/1.0' }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        let healthData = null;
        try {
          healthData = await response.json();
        } catch (e) {
          // Response might not be JSON, that's okay
        }
        
        return {
          name: service.name,
          status: 'healthy',
          responseTime,
          statusCode: response.status,
          data: healthData
        };
      } else {
        return {
          name: service.name,
          status: 'unhealthy',
          responseTime,
          statusCode: response.status,
          error: `HTTP ${response.status} ${response.statusText}`
        };
      }
    }
  } catch (error) {
    return {
      name: service.name,
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function performHealthCheck() {
  logger.info('🏥 Starting MCP Engine health check...');
  
  const results = await Promise.all(
    SERVICES.map(service => checkService(service))
  );
  
  const summary = {
    timestamp: new Date().toISOString(),
    totalServices: results.length,
    healthyServices: results.filter(r => r.status === 'healthy').length,
    unhealthyServices: results.filter(r => r.status === 'unhealthy').length,
    criticalFailures: results.filter(r => r.status === 'unhealthy' && 
      SERVICES.find(s => s.name === r.name)?.critical).length,
    averageResponseTime: Math.round(
      results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length
    ),
    results
  };
  
  // Log results
  logger.info(`📊 Health Check Summary:`);
  logger.info(`   Total Services: ${summary.totalServices}`);
  logger.info(`   Healthy: ${summary.healthyServices}`);
  logger.info(`   Unhealthy: ${summary.unhealthyServices}`);
  logger.info(`   Critical Failures: ${summary.criticalFailures}`);
  logger.info(`   Average Response Time: ${summary.averageResponseTime}ms`);
  
  // Log individual service results
  for (const result of results) {
    const icon = result.status === 'healthy' ? '✅' : '❌';
    const critical = SERVICES.find(s => s.name === result.name)?.critical ? ' (CRITICAL)' : '';
    
    if (result.status === 'healthy') {
      logger.info(`   ${icon} ${result.name}: ${result.responseTime}ms${critical}`);
    } else {
      logger.error(`   ${icon} ${result.name}: ${result.error}${critical}`);
    }
  }
  
  // Output JSON for programmatic consumption
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  }
  
  // Exit with appropriate code
  const exitCode = summary.criticalFailures > 0 ? 1 : 0;
  
  if (exitCode === 0) {
    logger.info('✅ All critical services are healthy');
  } else {
    logger.error(`❌ ${summary.criticalFailures} critical service(s) failed`);
  }
  
  return { summary, exitCode };
}

// Detailed service validation
async function performDetailedValidation() {
  logger.info('🔍 Performing detailed service validation...');
  
  const validations = [];
  
  // Test LLM Gateway regulation loading
  try {
    const response = await fetch('http://localhost:3002/api/llm/regulations?limit=1');
    const data = await response.json();
    
    if (data.pagination?.total > 0) {
      validations.push({
        test: 'LLM Gateway Regulation Loading',
        status: 'passed',
        message: `${data.pagination.total} regulations loaded`
      });
    } else {
      validations.push({
        test: 'LLM Gateway Regulation Loading',
        status: 'failed',
        message: 'No regulations loaded'
      });
    }
  } catch (error) {
    validations.push({
      test: 'LLM Gateway Regulation Loading',
      status: 'failed',
      message: error.message
    });
  }
  
  // Test WebSocket service functionality
  try {
    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket('ws://localhost:3003/regulation-updates');
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve();
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    validations.push({
      test: 'WebSocket Service Connection',
      status: 'passed',
      message: 'WebSocket connection successful'
    });
  } catch (error) {
    validations.push({
      test: 'WebSocket Service Connection',
      status: 'failed',
      message: error.message
    });
  }
  
  // Log validation results
  for (const validation of validations) {
    const icon = validation.status === 'passed' ? '✅' : '❌';
    logger.info(`   ${icon} ${validation.test}: ${validation.message}`);
  }
  
  return validations;
}

// Main execution
async function main() {
  try {
    const { summary, exitCode } = await performHealthCheck();
    
    if (process.argv.includes('--detailed')) {
      await performDetailedValidation();
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    logger.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
