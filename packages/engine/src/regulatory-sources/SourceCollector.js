/**
 * Base class for regulatory source collectors
 * Defines the interface that all specific collectors must implement
 */
class SourceCollector {
  constructor(config = {}) {
    this.config = config;
    this.name = config.name || 'Generic Source Collector';
    this.baseUrl = config.baseUrl || '';
    this.sourceAuthority = config.sourceAuthority || 'Unknown';
    this.refreshInterval = config.refreshInterval || 86400000; // Default: daily in ms
    this.lastFetchTime = null;
  }

  /**
   * Initialize the collector
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    console.log(`Initializing ${this.name} collector`);
    // To be implemented by subclasses
    return true;
  }

  /**
   * Fetch regulations from the source
   * @returns {Promise<Array>} Array of regulation objects
   */
  async fetchRegulations() {
    throw new Error('fetchRegulations must be implemented by subclass');
  }

  /**
   * Detect changes in regulations compared to stored versions
   * @param {Array} regulations - Newly fetched regulations
   * @param {Array} storedRegulations - Regulations currently stored in the system
   * @returns {Promise<Object>} Object containing added, updated, and unchanged regulations
   */
  async detectChanges(regulations, storedRegulations) {
    const added = [];
    const updated = [];
    const unchanged = [];

    // Simple implementation - override in subclasses for more sophisticated change detection
    regulations.forEach(regulation => {
      const stored = storedRegulations.find(r => r.regulationId === regulation.regulationId);
      
      if (!stored) {
        added.push(regulation);
      } else if (stored.version !== regulation.version || 
                 stored.lastModified !== regulation.lastModified) {
        updated.push(regulation);
      } else {
        unchanged.push(regulation);
      }
    });

    return { added, updated, unchanged };
  }

  /**
   * Process a regulation to standardize format
   * @param {Object} regulation - Raw regulation from source
   * @returns {Object} Processed regulation in standard format
   */
  processRegulation(regulation) {
    // Basic processing - override in subclasses for source-specific processing
    return {
      ...regulation,
      sourceAuthority: this.sourceAuthority,
      sourceUrl: this.baseUrl,
      fetchTime: new Date().toISOString(),
      collector: this.name
    };
  }

  /**
   * Check if regulations need to be refreshed based on last fetch time
   * @returns {boolean} True if refresh is needed
   */
  needsRefresh() {
    if (!this.lastFetchTime) return true;
    
    const now = Date.now();
    const timeSinceLastFetch = now - new Date(this.lastFetchTime).getTime();
    return timeSinceLastFetch >= this.refreshInterval;
  }

  /**
   * Get source metadata
   * @returns {Object} Metadata about this source
   */
  getSourceMetadata() {
    return {
      name: this.name,
      authority: this.sourceAuthority,
      baseUrl: this.baseUrl,
      lastFetchTime: this.lastFetchTime,
      refreshInterval: this.refreshInterval
    };
  }
}

module.exports = SourceCollector; 