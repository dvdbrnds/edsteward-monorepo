/**
 * Regulation Repository
 * Handles data access for regulations from various sources
 */
import { BaseRepository } from '../interfaces/repository.js';
import { setupLogger } from '../../utils/logger.js';
import { config } from '../../core/config.js';
import { DatabaseError, ValidationError } from '../../core/error-types.js';

export class RegulationRepository extends BaseRepository {
  constructor(options = {}) {
    super();
    this.logger = setupLogger('regulation-repository');
    this.regulations = [];
    this.loaded = false;
    this.cacheRepository = options.cacheRepository;
    this.cacheEnabled = !!this.cacheRepository;
  }

  /**
   * Load regulations from CSV file
   * @returns {Promise<void>}
   */
  async loadFromCSV() {
    try {
      if (this.loaded) {
        this.logger.debug('Regulations already loaded, skipping...');
        return;
      }

      // Check cache first
      if (this.cacheEnabled) {
        const cached = await this.cacheRepository.get('regulations:all');
        if (cached) {
          this.regulations = cached;
          this.loaded = true;
          this.logger.info(`Loaded ${this.regulations.length} regulations from cache`);
          return;
        }
      }

      const { parse } = await import('csv-parse/sync');
      const fs = await import('fs');
      const path = await import('path');
      
      const csvFilePath = path.resolve(process.cwd(), config.paths.regulationsFile);
      
      if (!fs.existsSync(csvFilePath)) {
        throw new DatabaseError(`Regulations file not found: ${csvFilePath}`);
      }
      
      const fileContent = fs.readFileSync(csvFilePath, 'utf8');
      
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });
      
      // Transform and validate records
      this.regulations = records.map((record, index) => 
        this._transformRecord(record, index)
      ).filter(reg => this._isValidRegulation(reg));
      
      this.loaded = true;
      
      // Cache the results
      if (this.cacheEnabled) {
        await this.cacheRepository.set('regulations:all', this.regulations, 3600); // Cache for 1 hour
      }
      
      this.logger.info(`Loaded ${this.regulations.length} regulations from CSV`);
    } catch (error) {
      this.logger.error(`Failed to load regulations: ${error.message}`);
      throw new DatabaseError(`Failed to load regulations: ${error.message}`, {
        source: 'csv',
        file: config.paths.regulationsFile
      });
    }
  }

  /**
   * Transform CSV record to regulation object
   * @private
   */
  _transformRecord(record, index) {
    return {
      id: index + 1,
      category: this._cleanString(record.Category) || 'Uncategorized',
      name: this._cleanString(record.Name) || 'Unnamed',
      description: this._cleanString(record.Description) || '',
      statute: this._cleanString(record.Statute) || '',
      regulation: this._cleanString(record.Regulation) || '',
      deadline: this._cleanString(record.Deadline) || '',
      reportingRequirements: this._cleanString(record['Reporting Requirements']) || '',
      keywords: this._extractKeywords(record),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...this._extractAdditionalFields(record)
    };
  }

  /**
   * Clean string values
   * @private
   */
  _cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /**
   * Extract keywords for search
   * @private
   */
  _extractKeywords(record) {
    const fields = [record.Name, record.Category, record.Statute, record.Description];
    return fields
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Extract additional fields from record
   * @private
   */
  _extractAdditionalFields(record) {
    const standardFields = [
      'Category', 'Name', 'Description', 'Statute', 
      'Regulation', 'Deadline', 'Reporting Requirements'
    ];
    
    const additional = {};
    Object.keys(record).forEach(key => {
      if (!standardFields.includes(key)) {
        additional[key] = record[key];
      }
    });
    
    return { additionalData: additional };
  }

  /**
   * Validate regulation object
   * @private
   */
  _isValidRegulation(regulation) {
    return regulation.name && regulation.name !== 'Unnamed';
  }

  /**
   * Ensure regulations are loaded
   * @private
   */
  async _ensureLoaded() {
    if (!this.loaded) {
      await this.loadFromCSV();
    }
  }

  // BaseRepository interface implementations

  async findById(id) {
    await this._ensureLoaded();
    const regulation = this.regulations.find(reg => reg.id === parseInt(id));
    return regulation || null;
  }

  async findMany(filters = {}, options = {}) {
    await this._ensureLoaded();
    
    let results = [...this.regulations];
    
    // Apply filters
    if (filters.category) {
      results = results.filter(reg => 
        reg.category.toLowerCase() === filters.category.toLowerCase()
      );
    }
    
    if (filters.keywords) {
      const searchTerms = filters.keywords.toLowerCase().split(/\s+/);
      results = results.filter(reg => 
        searchTerms.some(term => 
          reg.keywords.some(keyword => keyword.includes(term))
        )
      );
    }
    
    if (filters.ids && Array.isArray(filters.ids)) {
      results = results.filter(reg => filters.ids.includes(reg.id));
    }
    
    // Apply sorting
    if (options.sortBy) {
      results.sort((a, b) => {
        const aVal = a[options.sortBy] || '';
        const bVal = b[options.sortBy] || '';
        const order = options.sortOrder === 'desc' ? -1 : 1;
        return aVal.toString().localeCompare(bVal.toString()) * order;
      });
    }
    
    // Apply pagination
    if (options.limit) {
      const offset = options.offset || 0;
      results = results.slice(offset, offset + options.limit);
    }
    
    return results;
  }

  async findAll() {
    await this._ensureLoaded();
    return [...this.regulations];
  }

  async findByCategory(category) {
    return this.findMany({ category });
  }

  async findByKeywords(keywords) {
    return this.findMany({ keywords });
  }

  async getCategories() {
    await this._ensureLoaded();
    const categories = [...new Set(this.regulations.map(reg => reg.category))];
    return categories.sort();
  }

  async count(filters = {}) {
    const results = await this.findMany(filters);
    return results.length;
  }

  async exists(id) {
    const regulation = await this.findById(id);
    return !!regulation;
  }

  // These methods support in-memory operations for advanced features
  async create(data) {
    await this._ensureLoaded();
    
    // Generate new ID
    const maxId = this.regulations.length > 0 
      ? Math.max(...this.regulations.map(r => r.id)) 
      : 0;
    
    const regulation = {
      id: maxId + 1,
      category: data.category || 'Uncategorized',
      name: data.title || data.name || 'Unnamed',
      description: data.description || '',
      statute: data.statute || '',
      regulation: data.regulation || data.content || '',
      deadline: data.deadline || '',
      reportingRequirements: data.reportingRequirements || '',
      keywords: this._extractKeywordsFromData(data),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: data.metadata || {},
      type: data.type || 'regulation',
      status: data.status || 'active',
      version: 1,
      ...data
    };
    
    this.regulations.push(regulation);
    
    // Clear cache if enabled
    if (this.cacheEnabled) {
      await this.cacheRepository.delete('regulations:all');
    }
    
    return regulation;
  }

  async update(id, data) {
    await this._ensureLoaded();
    
    const index = this.regulations.findIndex(reg => reg.id === parseInt(id));
    if (index === -1) {
      throw new Error(`Regulation with ID ${id} not found`);
    }
    
    const existing = this.regulations[index];
    const updated = {
      ...existing,
      ...data,
      id: existing.id, // Preserve ID
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1
    };
    
    // Update keywords if content changed
    if (data.title || data.name || data.content || data.description) {
      updated.keywords = this._extractKeywordsFromData(updated);
    }
    
    this.regulations[index] = updated;
    
    // Clear cache if enabled
    if (this.cacheEnabled) {
      await this.cacheRepository.delete('regulations:all');
    }
    
    return updated;
  }

  async delete(id) {
    await this._ensureLoaded();
    
    const index = this.regulations.findIndex(reg => reg.id === parseInt(id));
    if (index === -1) {
      throw new Error(`Regulation with ID ${id} not found`);
    }
    
    const deleted = this.regulations.splice(index, 1)[0];
    
    // Clear cache if enabled
    if (this.cacheEnabled) {
      await this.cacheRepository.delete('regulations:all');
    }
    
    return deleted;
  }

  /**
   * Extract keywords from regulation data
   * @private
   */
  _extractKeywordsFromData(data) {
    const fields = [
      data.title || data.name,
      data.category,
      data.statute,
      data.description,
      data.content
    ];
    
    return fields
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Refresh regulations from source
   */
  async refresh() {
    this.loaded = false;
    this.regulations = [];
    
    if (this.cacheEnabled) {
      await this.cacheRepository.delete('regulations:all');
    }
    
    await this.loadFromCSV();
  }

  /**
   * Get regulation statistics
   */
  async getStats() {
    await this._ensureLoaded();
    
    const categories = {};
    this.regulations.forEach(reg => {
      categories[reg.category] = (categories[reg.category] || 0) + 1;
    });
    
    return {
      total: this.regulations.length,
      categories,
      lastLoaded: this.loaded ? new Date().toISOString() : null
    };
  }
} 