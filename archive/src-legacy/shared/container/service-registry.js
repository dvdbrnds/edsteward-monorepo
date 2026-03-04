/**
 * Service Registry
 * Registers all services and their dependencies
 */
import { container } from './service-container.js';
import { RegulationRepository } from '../repositories/regulation-repository.js';
import { MemoryCacheRepository } from '../repositories/memory-cache-repository.js';
import { ComplianceService } from '../services/compliance-service.js';
import { LLMService } from '../services/llm-service.js';
import { setupLogger } from '../../utils/logger.js';

const logger = setupLogger('service-registry');

/**
 * Register all services in the container
 */
export function registerServices() {
  logger.info('Registering services...');

  try {
    // Register repositories first (no dependencies)
    container.register('cacheRepository', MemoryCacheRepository, {
      singleton: true
    });

    container.register('regulationRepository', RegulationRepository, {
      dependencies: ['cacheRepository'],
      singleton: true
    });

    // Register core services
    container.register('llmService', LLMService, {
      singleton: true
    });

    container.register('complianceService', ComplianceService, {
      dependencies: [
        'regulationRepository',
        'llmService', 
        'cacheRepository'
      ],
      singleton: true
    });

    // Register factory for creating configured instances
    container.registerFactory('configuredComplianceService', (deps) => {
      return new ComplianceService({
        regulationRepository: deps.regulationRepository,
        llmService: deps.llmService,
        cacheRepository: deps.cacheRepository,
        logger: setupLogger('compliance-service')
      });
    }, {
      dependencies: ['regulationRepository', 'llmService', 'cacheRepository'],
      singleton: true
    });

    logger.info('Services registered successfully');
    logger.debug('Registered services:', container.getServiceNames());

  } catch (error) {
    logger.error('Failed to register services:', error.message);
    throw error;
  }
}

/**
 * Initialize all services (load data, establish connections, etc.)
 */
export async function initializeServices() {
  logger.info('Initializing services...');

  try {
    // Initialize regulation repository (load CSV data)
    const regulationRepo = container.resolve('regulationRepository');
    await regulationRepo.loadFromCSV();

    // Initialize LLM service (check availability)
    const llmService = container.resolve('llmService');
    const isLLMAvailable = await llmService.isAvailable();
    logger.info(`LLM service available: ${isLLMAvailable}`);

    logger.info('Services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error.message);
    throw error;
  }
}

/**
 * Get a fully configured compliance service
 */
export function getComplianceService() {
  return container.resolve('complianceService');
}

/**
 * Get regulation repository
 */
export function getRegulationRepository() {
  return container.resolve('regulationRepository');
}

/**
 * Get LLM service
 */
export function getLLMService() {
  return container.resolve('llmService');
}

/**
 * Get cache repository
 */
export function getCacheRepository() {
  return container.resolve('cacheRepository');
}

/**
 * Setup and initialize all services
 */
export async function setupServices() {
  registerServices();
  await initializeServices();
  return container;
}

/**
 * Get service health status
 */
export async function getServiceHealth() {
  const health = {
    services: {},
    overall: 'healthy',
    timestamp: new Date().toISOString()
  };

  try {
    // Check regulation repository
    const regulationRepo = container.resolve('regulationRepository');
    const regulationStats = await regulationRepo.getStats();
    health.services.regulationRepository = {
      status: regulationStats.total > 0 ? 'healthy' : 'unhealthy',
      details: regulationStats
    };

    // Check LLM service
    const llmService = container.resolve('llmService');
    const isLLMAvailable = await llmService.isAvailable();
    health.services.llmService = {
      status: isLLMAvailable ? 'healthy' : 'degraded',
      details: { available: isLLMAvailable, mockMode: llmService.mockMode }
    };

    // Check cache repository
    const cacheRepo = container.resolve('cacheRepository');
    health.services.cacheRepository = {
      status: 'healthy',
      details: cacheRepo.getStats ? cacheRepo.getStats() : {}
    };

    // Check compliance service
    try {
      const complianceService = container.resolve('complianceService');
      health.services.complianceService = {
        status: 'healthy',
        details: { initialized: true }
      };
    } catch (error) {
      health.services.complianceService = {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }

    // Determine overall health
    const statuses = Object.values(health.services).map(s => s.status);
    if (statuses.some(s => s === 'unhealthy')) {
      health.overall = 'unhealthy';
    } else if (statuses.some(s => s === 'degraded')) {
      health.overall = 'degraded';
    }

  } catch (error) {
    logger.error('Error checking service health:', error.message);
    health.overall = 'unhealthy';
    health.error = error.message;
  }

  return health;
} 