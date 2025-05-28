/**
 * Advanced Regulation Service - Phase 4
 * Enhanced regulation management with versioning, search, and bulk operations
 */

import { BaseService } from '../interfaces/service.js';
import { cacheManager } from '../cache/CacheManager.js';
import { logger } from '../../utils/logger.js';

export class AdvancedRegulationService extends BaseService {
  constructor(regulationRepository, config = {}) {
    super();
    this.regulationRepository = regulationRepository;
    this.config = {
      enableVersioning: config.enableVersioning !== false,
      maxVersions: config.maxVersions || 10,
      enableSearch: config.enableSearch !== false,
      searchIndexRefreshInterval: config.searchIndexRefreshInterval || 300000, // 5 minutes
      enableBulkOperations: config.enableBulkOperations !== false,
      maxBulkSize: config.maxBulkSize || 1000,
      enableMetadata: config.enableMetadata !== false,
      cacheEnabled: config.cacheEnabled !== false,
      cacheTTL: config.cacheTTL || 3600,
      ...config
    };

    this.searchIndex = new Map();
    this.regulationVersions = new Map();
    this.metadata = new Map();
    this.isInitialized = false;

    // Don't auto-initialize in constructor - let the caller control when to initialize
    // this.initialize();
  }

  /**
   * Initialize the advanced regulation service
   */
  async initialize() {
    try {
      await super.initialize();
      
      // Load existing regulations and build search index
      await this.loadRegulations();
      await this.buildSearchIndex();
      
      // Start periodic search index refresh
      if (this.config.enableSearch) {
        this.startSearchIndexRefresh();
      }

      this.isInitialized = true;
      logger.info('[advanced-regulation-service] Service initialized successfully');

    } catch (error) {
      logger.error('[advanced-regulation-service] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get regulation by ID with version support
   */
  async getRegulation(id, version = 'latest') {
    try {
      const cacheKey = `regulation:${id}:${version}`;
      
      if (this.config.cacheEnabled) {
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      let regulation;
      
      if (version === 'latest') {
        regulation = await this.regulationRepository.findById(id);
      } else {
        regulation = await this.getRegulationVersion(id, version);
      }

      if (regulation && this.config.enableMetadata) {
        regulation.metadata = this.metadata.get(id) || {};
      }

      if (regulation && this.config.cacheEnabled) {
        await cacheManager.set(cacheKey, regulation, { 
          ttl: this.config.cacheTTL,
          tags: ['regulations', `regulation:${id}`]
        });
      }

      return regulation;

    } catch (error) {
      logger.error('[advanced-regulation-service] Error getting regulation:', error);
      throw error;
    }
  }

  /**
   * Create new regulation with versioning
   */
  async createRegulation(regulationData) {
    try {
      // Validate regulation data
      this.validateRegulationData(regulationData);

      // Add metadata
      const enrichedData = {
        ...regulationData,
        id: regulationData.id || this.generateRegulationId(),
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: regulationData.status || 'active'
      };

      // Create regulation
      const regulation = await this.regulationRepository.create(enrichedData);

      // Initialize versioning
      if (this.config.enableVersioning) {
        await this.createRegulationVersion(regulation);
      }

      // Update search index
      if (this.config.enableSearch) {
        await this.addToSearchIndex(regulation);
      }

      // Store metadata
      if (this.config.enableMetadata && regulationData.metadata) {
        this.metadata.set(regulation.id, regulationData.metadata);
      }

      // Invalidate cache
      await this.invalidateRegulationCache(regulation.id);

      logger.info('[advanced-regulation-service] Created regulation:', regulation.id);
      return regulation;

    } catch (error) {
      logger.error('[advanced-regulation-service] Error creating regulation:', error);
      throw error;
    }
  }

  /**
   * Update regulation with versioning
   */
  async updateRegulation(id, updateData) {
    try {
      const existingRegulation = await this.getRegulation(id);
      if (!existingRegulation) {
        throw new Error(`Regulation not found: ${id}`);
      }

      // Create new version if versioning is enabled
      if (this.config.enableVersioning) {
        await this.createRegulationVersion(existingRegulation);
      }

      // Update regulation
      const updatedData = {
        ...updateData,
        version: (existingRegulation.version || 1) + 1,
        updatedAt: new Date().toISOString()
      };

      const updatedRegulation = await this.regulationRepository.update(id, updatedData);

      // Update search index
      if (this.config.enableSearch) {
        await this.updateSearchIndex(updatedRegulation);
      }

      // Update metadata
      if (this.config.enableMetadata && updateData.metadata) {
        this.metadata.set(id, { ...this.metadata.get(id), ...updateData.metadata });
      }

      // Invalidate cache
      await this.invalidateRegulationCache(id);

      logger.info('[advanced-regulation-service] Updated regulation:', id);
      return updatedRegulation;

    } catch (error) {
      logger.error('[advanced-regulation-service] Error updating regulation:', error);
      throw error;
    }
  }

  /**
   * Delete regulation with soft delete support
   */
  async deleteRegulation(id, softDelete = true) {
    try {
      if (softDelete) {
        return await this.updateRegulation(id, { 
          status: 'deleted',
          deletedAt: new Date().toISOString()
        });
      } else {
        // Hard delete
        await this.regulationRepository.delete(id);
        
        // Remove from search index
        if (this.config.enableSearch) {
          await this.removeFromSearchIndex(id);
        }

        // Remove versions
        if (this.config.enableVersioning) {
          this.regulationVersions.delete(id);
        }

        // Remove metadata
        this.metadata.delete(id);

        // Invalidate cache
        await this.invalidateRegulationCache(id);

        logger.info('[advanced-regulation-service] Deleted regulation:', id);
        return true;
      }

    } catch (error) {
      logger.error('[advanced-regulation-service] Error deleting regulation:', error);
      throw error;
    }
  }

  /**
   * Search regulations with advanced filtering
   */
  async searchRegulations(query, options = {}) {
    try {
      const {
        filters = {},
        sort = { field: 'updatedAt', order: 'desc' },
        pagination = { page: 1, limit: 50 },
        includeMetadata = false
      } = options;

      let results = [];

      if (this.config.enableSearch && query) {
        // Text search using search index
        results = await this.performTextSearch(query, filters);
      } else {
        // Filter-based search
        results = await this.performFilterSearch(filters);
      }

      // Apply sorting
      results = this.sortResults(results, sort);

      // Apply pagination
      const total = results.length;
      const startIndex = (pagination.page - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      const paginatedResults = results.slice(startIndex, endIndex);

      // Include metadata if requested
      if (includeMetadata) {
        for (const regulation of paginatedResults) {
          regulation.metadata = this.metadata.get(regulation.id) || {};
        }
      }

      return {
        results: paginatedResults,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit)
        }
      };

    } catch (error) {
      logger.error('[advanced-regulation-service] Error searching regulations:', error);
      throw error;
    }
  }

  /**
   * Bulk create regulations
   */
  async bulkCreateRegulations(regulationsData) {
    if (!this.config.enableBulkOperations) {
      throw new Error('Bulk operations are disabled');
    }

    if (regulationsData.length > this.config.maxBulkSize) {
      throw new Error(`Bulk size exceeds maximum: ${this.config.maxBulkSize}`);
    }

    try {
      const results = [];
      const errors = [];

      for (let i = 0; i < regulationsData.length; i++) {
        try {
          const regulation = await this.createRegulation(regulationsData[i]);
          results.push({ index: i, success: true, data: regulation });
        } catch (error) {
          errors.push({ index: i, success: false, error: error.message });
        }
      }

      logger.info(`[advanced-regulation-service] Bulk created ${results.length} regulations with ${errors.length} errors`);
      
      return {
        success: results,
        errors,
        summary: {
          total: regulationsData.length,
          successful: results.length,
          failed: errors.length
        }
      };

    } catch (error) {
      logger.error('[advanced-regulation-service] Error in bulk create:', error);
      throw error;
    }
  }

  /**
   * Bulk update regulations
   */
  async bulkUpdateRegulations(updates) {
    if (!this.config.enableBulkOperations) {
      throw new Error('Bulk operations are disabled');
    }

    if (updates.length > this.config.maxBulkSize) {
      throw new Error(`Bulk size exceeds maximum: ${this.config.maxBulkSize}`);
    }

    try {
      const results = [];
      const errors = [];

      for (let i = 0; i < updates.length; i++) {
        try {
          const { id, data } = updates[i];
          const regulation = await this.updateRegulation(id, data);
          results.push({ index: i, id, success: true, data: regulation });
        } catch (error) {
          errors.push({ index: i, id: updates[i].id, success: false, error: error.message });
        }
      }

      logger.info(`[advanced-regulation-service] Bulk updated ${results.length} regulations with ${errors.length} errors`);
      
      return {
        success: results,
        errors,
        summary: {
          total: updates.length,
          successful: results.length,
          failed: errors.length
        }
      };

    } catch (error) {
      logger.error('[advanced-regulation-service] Error in bulk update:', error);
      throw error;
    }
  }

  /**
   * Get regulation versions
   */
  async getRegulationVersions(id) {
    if (!this.config.enableVersioning) {
      throw new Error('Versioning is disabled');
    }

    const versions = this.regulationVersions.get(id) || [];
    return versions.sort((a, b) => b.version - a.version);
  }

  /**
   * Get regulation statistics
   */
  async getRegulationStats() {
    try {
      const allRegulations = await this.regulationRepository.findAll();
      
      const stats = {
        total: allRegulations.length,
        active: allRegulations.filter(r => r.status === 'active').length,
        inactive: allRegulations.filter(r => r.status === 'inactive').length,
        deleted: allRegulations.filter(r => r.status === 'deleted').length,
        byCategory: {},
        byType: {},
        recentlyUpdated: allRegulations.filter(r => {
          const updatedAt = new Date(r.updatedAt);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return updatedAt > weekAgo;
        }).length
      };

      // Group by category and type
      for (const regulation of allRegulations) {
        if (regulation.category) {
          stats.byCategory[regulation.category] = (stats.byCategory[regulation.category] || 0) + 1;
        }
        if (regulation.type) {
          stats.byType[regulation.type] = (stats.byType[regulation.type] || 0) + 1;
        }
      }

      return stats;

    } catch (error) {
      logger.error('[advanced-regulation-service] Error getting stats:', error);
      throw error;
    }
  }

  // Private helper methods

  async loadRegulations() {
    try {
      const regulations = await this.regulationRepository.findAll();
      logger.info(`[advanced-regulation-service] Loaded ${regulations.length} regulations`);
    } catch (error) {
      logger.warn('[advanced-regulation-service] Could not load regulations:', error);
    }
  }

  async buildSearchIndex() {
    if (!this.config.enableSearch) return;

    try {
      const regulations = await this.regulationRepository.findAll();
      this.searchIndex.clear();

      for (const regulation of regulations) {
        await this.addToSearchIndex(regulation);
      }

      logger.info(`[advanced-regulation-service] Built search index for ${regulations.length} regulations`);
    } catch (error) {
      logger.error('[advanced-regulation-service] Error building search index:', error);
    }
  }

  async addToSearchIndex(regulation) {
    if (!this.config.enableSearch) return;

    const searchableText = [
      regulation.title,
      regulation.description,
      regulation.content,
      regulation.category,
      regulation.type,
      ...(regulation.tags || [])
    ].filter(Boolean).join(' ').toLowerCase();

    this.searchIndex.set(regulation.id, {
      id: regulation.id,
      searchableText,
      regulation
    });
  }

  async updateSearchIndex(regulation) {
    await this.addToSearchIndex(regulation);
  }

  async removeFromSearchIndex(id) {
    this.searchIndex.delete(id);
  }

  async performTextSearch(query, filters) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    const results = [];

    for (const [id, indexEntry] of this.searchIndex) {
      let score = 0;
      
      for (const term of searchTerms) {
        if (indexEntry.searchableText.includes(term)) {
          score++;
        }
      }

      if (score > 0 && this.matchesFilters(indexEntry.regulation, filters)) {
        results.push({ ...indexEntry.regulation, searchScore: score });
      }
    }

    return results.sort((a, b) => b.searchScore - a.searchScore);
  }

  async performFilterSearch(filters) {
    const regulations = await this.regulationRepository.findAll();
    return regulations.filter(regulation => this.matchesFilters(regulation, filters));
  }

  matchesFilters(regulation, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (regulation[key] !== value) {
        return false;
      }
    }
    return true;
  }

  sortResults(results, sort) {
    return results.sort((a, b) => {
      const aValue = a[sort.field];
      const bValue = b[sort.field];
      
      if (sort.order === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });
  }

  async createRegulationVersion(regulation) {
    if (!this.config.enableVersioning) return;

    const versions = this.regulationVersions.get(regulation.id) || [];
    versions.push({
      ...regulation,
      versionCreatedAt: new Date().toISOString()
    });

    // Keep only the latest versions
    if (versions.length > this.config.maxVersions) {
      versions.splice(0, versions.length - this.config.maxVersions);
    }

    this.regulationVersions.set(regulation.id, versions);
  }

  async getRegulationVersion(id, version) {
    const versions = this.regulationVersions.get(id) || [];
    return versions.find(v => v.version === parseInt(version));
  }

  async invalidateRegulationCache(id) {
    if (this.config.cacheEnabled) {
      await cacheManager.invalidateByTags([`regulation:${id}`]);
    }
  }

  validateRegulationData(data) {
    if (!data.title) {
      throw new Error('Regulation title is required');
    }
    if (!data.content) {
      throw new Error('Regulation content is required');
    }
  }

  generateRegulationId() {
    return `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startSearchIndexRefresh() {
    setInterval(async () => {
      try {
        await this.buildSearchIndex();
      } catch (error) {
        logger.error('[advanced-regulation-service] Error refreshing search index:', error);
      }
    }, this.config.searchIndexRefreshInterval);
  }

  /**
   * Get service health
   */
  async getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      details: {
        initialized: this.isInitialized,
        searchIndexSize: this.searchIndex.size,
        versionedRegulations: this.regulationVersions.size,
        metadataEntries: this.metadata.size,
        features: {
          versioning: this.config.enableVersioning,
          search: this.config.enableSearch,
          bulkOperations: this.config.enableBulkOperations,
          metadata: this.config.enableMetadata,
          caching: this.config.cacheEnabled
        }
      }
    };
  }
}

export default AdvancedRegulationService; 