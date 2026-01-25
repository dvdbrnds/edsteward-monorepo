/**
 * PM2 Ecosystem Configuration for EdSteward
 * 
 * Usage:
 *   Development:  pm2 start ecosystem.config.cjs --env development
 *   Production:   pm2 start ecosystem.config.cjs --env production
 *   
 *   pm2 logs edsteward     - View logs
 *   pm2 monit              - Monitor dashboard
 *   pm2 restart edsteward  - Restart app
 *   pm2 stop edsteward     - Stop app
 *   pm2 delete edsteward   - Remove from PM2
 */

module.exports = {
  apps: [
    {
      name: 'edsteward',
      script: './scripts/start-dev.sh',  // Wrapper that kills port 3000 first
      cwd: '/Users/dvdbrnds/Desktop/ES Clientside/EdSteward',
      interpreter: '/bin/zsh',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,  // Don't watch for file changes (Vite handles HMR)
      max_memory_restart: '1G',
      
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,  // Wait 3s between restarts to ensure port is released
      kill_timeout: 5000,   // Give 5s for graceful shutdown
      
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      
      // Logging
      error_file: '/Users/dvdbrnds/Desktop/ES Clientside/EdSteward/logs/pm2-error.log',
      out_file: '/Users/dvdbrnds/Desktop/ES Clientside/EdSteward/logs/pm2-out.log',
      merge_logs: true,
      time: true,
      
      // Environment variables for development
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      
      // Environment variables for production (local)
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
