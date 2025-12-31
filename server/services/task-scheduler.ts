/**
 * Task Scheduler Service
 * Automatically runs task notification checks on a schedule
 */

import { checkAndSendTaskNotifications } from './task-notifications';

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// Configuration - can be modified at runtime
const SCHEDULER_CONFIG = {
  // Check every 6 hours by default (in milliseconds)
  intervalMs: 6 * 60 * 60 * 1000,
  // Also check at specific hours (24-hour format)
  preferredHours: [8, 14], // 8 AM and 2 PM
  // Enable/disable based on environment (can be toggled at runtime)
  enabled: process.env.ENABLE_TASK_SCHEDULER !== 'false',
};

/**
 * Enable or disable the scheduler at runtime
 */
export function setSchedulerEnabled(enabled: boolean): void {
  SCHEDULER_CONFIG.enabled = enabled;
  if (enabled && !schedulerInterval) {
    startTaskScheduler();
  } else if (!enabled && schedulerInterval) {
    stopTaskScheduler();
  }
  console.log(`[TaskScheduler] Scheduler ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Run the notification check
 */
async function runNotificationCheck(): Promise<void> {
  if (isRunning) {
    console.log('[TaskScheduler] Skipping - previous check still running');
    return;
  }

  isRunning = true;
  console.log(`[TaskScheduler] Starting scheduled notification check at ${new Date().toISOString()}`);

  try {
    const results = await checkAndSendTaskNotifications();
    console.log(`[TaskScheduler] Completed. Checked: ${results.tasksChecked}, Sent: ${results.notificationsSent}, Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.warn('[TaskScheduler] Errors encountered:', results.errors);
    }
  } catch (error) {
    console.error('[TaskScheduler] Failed to run notification check:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Check if current hour is a preferred notification hour
 */
function isPreferredHour(): boolean {
  const currentHour = new Date().getHours();
  return SCHEDULER_CONFIG.preferredHours.includes(currentHour);
}

/**
 * Start the task scheduler
 */
export function startTaskScheduler(): void {
  if (!SCHEDULER_CONFIG.enabled) {
    console.log('[TaskScheduler] Disabled via ENABLE_TASK_SCHEDULER=false');
    return;
  }

  if (schedulerInterval) {
    console.log('[TaskScheduler] Already running');
    return;
  }

  console.log('[TaskScheduler] Starting scheduler...');
  console.log(`[TaskScheduler] Will check every ${SCHEDULER_CONFIG.intervalMs / (60 * 60 * 1000)} hours`);
  console.log(`[TaskScheduler] Preferred hours: ${SCHEDULER_CONFIG.preferredHours.join(', ')}`);

  // Run initial check after a short delay (give server time to fully start)
  setTimeout(() => {
    console.log('[TaskScheduler] Running initial check...');
    runNotificationCheck();
  }, 30000); // 30 seconds after startup

  // Set up regular interval
  schedulerInterval = setInterval(() => {
    // Only run at preferred hours OR if it's been too long
    if (isPreferredHour()) {
      runNotificationCheck();
    }
  }, 60 * 60 * 1000); // Check every hour, but only actually run at preferred times

  // Also set up a fallback interval that runs regardless of hour
  setInterval(() => {
    runNotificationCheck();
  }, SCHEDULER_CONFIG.intervalMs);

  console.log('[TaskScheduler] Scheduler started successfully');
}

/**
 * Stop the task scheduler
 */
export function stopTaskScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[TaskScheduler] Scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  enabled: boolean;
  running: boolean;
  intervalHours: number;
  preferredHours: number[];
} {
  return {
    enabled: SCHEDULER_CONFIG.enabled,
    running: schedulerInterval !== null,
    intervalHours: SCHEDULER_CONFIG.intervalMs / (60 * 60 * 1000),
    preferredHours: SCHEDULER_CONFIG.preferredHours,
  };
}

/**
 * Manually trigger a notification check
 */
export async function triggerManualCheck(): Promise<{
  tasksChecked: number;
  notificationsSent: number;
  errors: string[];
}> {
  return await checkAndSendTaskNotifications();
}

