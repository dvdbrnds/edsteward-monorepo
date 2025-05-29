// Re-export from the new config location for backward compatibility
export { db, pool, isDevelopment, isProduction, isStaging, isTest } from './config/database';
import { syslog, LogFacility, LogLevel } from './services/syslog';

// Initialize logging after db setup
export function initializeLogging() {
  const currentEnv = process.env.NODE_ENV || 'development';
  console.log(`Database connected in ${currentEnv} environment`);

  if (currentEnv === 'production') {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
      "Connecting to PRODUCTION database - ensure all operations are approved");
  }

  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
    `Database connection initialized for ${currentEnv} environment`);
}