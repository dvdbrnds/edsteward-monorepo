/**
 * Regulation Sentinel — Automated Change Detection and Delivery
 *
 * Barrel export for all sentinel modules.
 */

export { runFullScan, scanFederalRegister, scanECFR, scanStateSource, loadTrackedRegulations } from './source-scanner.js';
export { classifySignal, classifyAll } from './change-classifier.js';
export { processPendingWorkflows, executeSignalWorkflow } from './workflow-executor.js';
export { processPendingDeliveries, deliverSignal } from './auto-delivery.js';
export { executeFullScan, runWorkflows, runDeliveries, startScheduler, runOnce } from './sentinel-service.js';
export {
  ensureSchema,
  createRun,
  completeRun,
  failRun,
  getRecentRuns,
  getRunById,
  insertSignal,
  updateSignalWorkflow,
  updateSignalDelivery,
  getSignalsForRun,
  getPendingWorkflowSignals,
  getPendingDeliverySignals,
  getDashboardStats,
  getRecentSignals,
  getSignalsForRegulation,
} from './sentinel-db.js';
