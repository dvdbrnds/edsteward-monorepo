/**
 * Service Container
 * Simple dependency injection container for managing services
 */
import { setupLogger } from '../../utils/logger.js';

export class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
    this.logger = setupLogger('service-container');
  }

  /**
   * Register a service class
   * @param {string} name - Service name
   * @param {Function} serviceClass - Service constructor
   * @param {Object} options - Registration options
   */
  register(name, serviceClass, options = {}) {
    const registration = {
      serviceClass,
      dependencies: options.dependencies || [],
      singleton: options.singleton !== false, // Default to singleton
      factory: options.factory || false
    };

    this.services.set(name, registration);
    this.logger.debug(`Registered service: ${name}`, {
      singleton: registration.singleton,
      dependencies: registration.dependencies
    });

    return this;
  }

  /**
   * Register a factory function
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @param {Object} options - Registration options
   */
  registerFactory(name, factory, options = {}) {
    this.factories.set(name, {
      factory,
      dependencies: options.dependencies || [],
      singleton: options.singleton !== false
    });

    this.logger.debug(`Registered factory: ${name}`);
    return this;
  }

  /**
   * Register a singleton instance
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   */
  registerInstance(name, instance) {
    this.singletons.set(name, instance);
    this.logger.debug(`Registered instance: ${name}`);
    return this;
  }

  /**
   * Resolve a service by name
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  resolve(name) {
    try {
      // Check for existing singleton
      if (this.singletons.has(name)) {
        return this.singletons.get(name);
      }

      // Check for factory
      if (this.factories.has(name)) {
        return this._resolveFactory(name);
      }

      // Check for service registration
      if (this.services.has(name)) {
        return this._resolveService(name);
      }

      throw new Error(`Service '${name}' not found`);
    } catch (error) {
      this.logger.error(`Failed to resolve service '${name}':`, error.message);
      throw error;
    }
  }

  /**
   * Resolve multiple services
   * @param {Array<string>} names - Service names
   * @returns {Object} Object with service instances
   */
  resolveMany(names) {
    const resolved = {};
    
    for (const name of names) {
      resolved[name] = this.resolve(name);
    }
    
    return resolved;
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name) || 
           this.factories.has(name) || 
           this.singletons.has(name);
  }

  /**
   * Get all registered service names
   * @returns {Array<string>}
   */
  getServiceNames() {
    const names = [
      ...this.services.keys(),
      ...this.factories.keys(),
      ...this.singletons.keys()
    ];
    
    return [...new Set(names)];
  }

  /**
   * Clear all registrations
   */
  clear() {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
    this.logger.info('Container cleared');
  }

  /**
   * Create a child container
   * @returns {ServiceContainer} Child container
   */
  createChild() {
    const child = new ServiceContainer();
    
    // Copy parent registrations
    this.services.forEach((registration, name) => {
      child.services.set(name, registration);
    });
    
    this.factories.forEach((factory, name) => {
      child.factories.set(name, factory);
    });
    
    return child;
  }

  // Private methods

  _resolveService(name) {
    const registration = this.services.get(name);
    
    // Check if we have a cached singleton
    if (registration.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Resolve dependencies
    const dependencies = this._resolveDependencies(registration.dependencies);
    
    // Create instance
    const instance = new registration.serviceClass(dependencies);
    
    // Cache if singleton
    if (registration.singleton) {
      this.singletons.set(name, instance);
    }
    
    this.logger.debug(`Resolved service: ${name}`);
    return instance;
  }

  _resolveFactory(name) {
    const registration = this.factories.get(name);
    
    // Check if we have a cached singleton
    if (registration.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Resolve dependencies
    const dependencies = this._resolveDependencies(registration.dependencies);
    
    // Call factory
    const instance = registration.factory(dependencies);
    
    // Cache if singleton
    if (registration.singleton) {
      this.singletons.set(name, instance);
    }
    
    this.logger.debug(`Resolved factory: ${name}`);
    return instance;
  }

  _resolveDependencies(dependencies) {
    if (!dependencies || dependencies.length === 0) {
      return {};
    }

    const resolved = {};
    
    for (const dep of dependencies) {
      if (typeof dep === 'string') {
        // Simple dependency name
        resolved[dep] = this.resolve(dep);
      } else if (typeof dep === 'object') {
        // Dependency with alias
        const { name: depName, as } = dep;
        resolved[as || depName] = this.resolve(depName);
      }
    }
    
    return resolved;
  }
}

/**
 * Default container instance
 */
export const container = new ServiceContainer();

/**
 * Setup default services
 */
export function setupDefaultServices() {
  // This will be called to register default services
  const logger = setupLogger('container-setup');
  logger.info('Setting up default services...');
  
  // Services will be registered here in the next step
  return container;
} 