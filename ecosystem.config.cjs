/**
 * PM2 Ecosystem Configuration for MCP Engine
 * 
 * This file defines all MCP Engine services for process management.
 * PM2 will automatically restart services if they crash.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js     - Start all services
 *   pm2 stop all                      - Stop all services
 *   pm2 restart all                   - Restart all services
 *   pm2 status                        - View service status
 *   pm2 logs                          - View all logs
 *   pm2 logs registry-api             - View specific service logs
 *   pm2 monit                         - Live monitoring dashboard
 *   pm2 save                          - Save current process list
 *   pm2 startup                       - Generate startup script
 */

module.exports = {
  apps: [
    // ============================================
    // CORE SERVICES
    // ============================================
    
    {
      name: 'registry-api',
      script: 'start-registry-postgres.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        PORT: 3010
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      error_file: 'logs/registry-api-error.log',
      out_file: 'logs/registry-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      instances: 1,
      exec_mode: 'fork'
    },
    
    {
      name: 'llm-gateway',
      script: 'src/llm-gateway/start-llm-gateway-phase4.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        PORT: 3004
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      error_file: 'logs/llm-gateway-error.log',
      out_file: 'logs/llm-gateway-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      instances: 1,
      exec_mode: 'fork'
    },
    
    {
      name: 'delivery-server',
      script: 'src/delivery-system/delivery-server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        PORT: 3003
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      error_file: 'logs/delivery-server-error.log',
      out_file: 'logs/delivery-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      instances: 1,
      exec_mode: 'fork'
    },
    
    {
      name: 'inquisitor',
      script: 'src/inquisitor-mcp/inquisitor-server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        INQUISITOR_PORT: 3061
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      error_file: 'logs/inquisitor-error.log',
      out_file: 'logs/inquisitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      instances: 1,
      exec_mode: 'fork'
    },
    
    // ============================================
    // FRONTEND (Vite Dev Server)
    // ============================================
    
    {
      name: 'frontend',
      script: 'npx',
      args: 'vite --port 3050 --host',
      cwd: require('path').join(__dirname, 'src/client'),
      env: {
        NODE_ENV: 'development'
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
      error_file: require('path').join(__dirname, 'logs/frontend-error.log'),
      out_file: require('path').join(__dirname, 'logs/frontend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
