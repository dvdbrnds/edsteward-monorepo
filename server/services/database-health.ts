import { pool as _pool, checkConnectionHealth, closeDatabaseConnection as _closeDatabaseConnection } from '../config/database';
import { syslog, LogFacility, LogLevel } from './syslog';

export class DatabaseHealthMonitor {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly WARMUP_PERIOD_MS = 60_000; // 60 seconds
  private readonly startedAt = Date.now();

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Initial health check
    await this.performHealthCheck();
    
    // Set up periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Database health monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Database health monitoring stopped');
  }

  isWarming(): boolean {
    return Date.now() - this.startedAt < this.WARMUP_PERIOD_MS;
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const isHealthy = await checkConnectionHealth();
      
      if (isHealthy) {
        if (this.consecutiveFailures > 0) {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
            `Database connection restored after ${this.consecutiveFailures} failures`);
        }
        this.consecutiveFailures = 0;
      } else {
        if (this.isWarming()) {
          console.log('[HEALTH] Warmup period — skipping failure increment');
          return;
        }
        this.consecutiveFailures++;
        console.warn(`⚠️ Database health check failed (${this.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES})`);
        
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
            `Database connection failed ${this.consecutiveFailures} consecutive times - initiating emergency shutdown`);
          
          await this.emergencyConnectionReset();
        }
      }
    } catch (error) {
      console.error('❌ Error during health check:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Database health check error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async emergencyConnectionReset(): Promise<void> {
    try {
      
      // Log the issue but don't close the pool - let it recover naturally
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
        'Database connection issues detected - monitoring for recovery');
      
      // Wait a moment before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      
      // Reset failure counter to give it a fresh start
      this.consecutiveFailures = 0;
      
    } catch (error) {
      console.error('❌ Error during emergency response:', error);
      syslog.log(LogFacility.LOCAL0, LogLevel.CRITICAL, 
        `Emergency response failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getHealthStatus(): {
    isMonitoring: boolean;
    consecutiveFailures: number;
    maxFailures: number;
    warming: boolean;
  } {
    return {
      isMonitoring: this.isMonitoring,
      consecutiveFailures: this.consecutiveFailures,
      maxFailures: this.MAX_CONSECUTIVE_FAILURES,
      warming: this.isWarming(),
    };
  }
}

// Export singleton instance
export const databaseHealthMonitor = new DatabaseHealthMonitor();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  databaseHealthMonitor.startMonitoring().catch(console.error);
} 