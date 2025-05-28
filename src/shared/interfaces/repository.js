/**
 * Base Repository Interfaces
 * Defines contracts for data access operations
 */

/**
 * Base Repository Interface
 * All repositories should implement these basic CRUD operations
 */
export class BaseRepository {
  /**
   * Find a single entity by ID
   * @param {string|number} id - Entity ID
   * @returns {Promise<Object|null>} Entity or null if not found
   */
  async findById(id) {
    throw new Error('findById method must be implemented');
  }

  /**
   * Find multiple entities with optional filters
   * @param {Object} filters - Search filters
   * @param {Object} options - Query options (limit, offset, sort)
   * @returns {Promise<Array>} Array of entities
   */
  async findMany(filters = {}, options = {}) {
    throw new Error('findMany method must be implemented');
  }

  /**
   * Find all entities
   * @returns {Promise<Array>} Array of all entities
   */
  async findAll() {
    throw new Error('findAll method must be implemented');
  }

  /**
   * Create a new entity
   * @param {Object} data - Entity data
   * @returns {Promise<Object>} Created entity
   */
  async create(data) {
    throw new Error('create method must be implemented');
  }

  /**
   * Update an existing entity
   * @param {string|number} id - Entity ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object|null>} Updated entity or null if not found
   */
  async update(id, data) {
    throw new Error('update method must be implemented');
  }

  /**
   * Delete an entity
   * @param {string|number} id - Entity ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(id) {
    throw new Error('delete method must be implemented');
  }

  /**
   * Check if entity exists
   * @param {string|number} id - Entity ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    throw new Error('exists method must be implemented');
  }

  /**
   * Get total count with optional filters
   * @param {Object} filters - Search filters
   * @returns {Promise<number>} Total count
   */
  async count(filters = {}) {
    throw new Error('count method must be implemented');
  }
}

/**
 * Cache Repository Interface
 * Defines contract for caching operations
 */
export class CacheRepository {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    throw new Error('get method must be implemented');
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<void>}
   */
  async set(key, value, ttl = 3600) {
    throw new Error('set method must be implemented');
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(key) {
    throw new Error('delete method must be implemented');
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if exists
   */
  async has(key) {
    throw new Error('has method must be implemented');
  }

  /**
   * Clear all cache
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('clear method must be implemented');
  }

  /**
   * Get multiple values from cache
   * @param {Array<string>} keys - Array of cache keys
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async mget(keys) {
    throw new Error('mget method must be implemented');
  }

  /**
   * Set multiple values in cache
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<void>}
   */
  async mset(keyValuePairs, ttl = 3600) {
    throw new Error('mset method must be implemented');
  }
} 