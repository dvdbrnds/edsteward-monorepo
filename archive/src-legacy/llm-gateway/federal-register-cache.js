/**
 * Federal Register Document Cache System
 * 
 * Downloads, stores, and manages Federal Register documents locally
 * with intelligent change detection and update mechanisms
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { existsSync } from 'fs';
import FederalRegisterAPIClient from './federal-register-api-client.js';

export class FederalRegisterCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), 'cache', 'federal-register');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
    this.documentsDir = path.join(this.cacheDir, 'documents');
    this.searchCacheDir = path.join(this.cacheDir, 'searches');
    
    this.apiClient = new FederalRegisterAPIClient(options.apiClient);
    this.maxAge = options.maxAge || 86400000; // 24 hours default
    this.maxDocuments = options.maxDocuments || 1000; // Limit storage
    
    this.metadata = {
      lastSync: null,
      documents: {},
      searches: {},
      stats: {
        totalDocuments: 0,
        totalSize: 0,
        lastCleanup: null
      }
    };
    
    this.initializeCache();
  }

  /**
   * Initialize cache directory structure and load metadata
   */
  async initializeCache() {
    try {
      // Create directory structure
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.mkdir(this.documentsDir, { recursive: true });
      await fs.mkdir(this.searchCacheDir, { recursive: true });
      
      // Load existing metadata
      if (existsSync(this.metadataFile)) {
        const metadataContent = await fs.readFile(this.metadataFile, 'utf8');
        this.metadata = { ...this.metadata, ...JSON.parse(metadataContent) };
        console.log(`📋 Loaded Federal Register cache metadata: ${this.metadata.stats.totalDocuments} documents`);
      } else {
        console.log('🆕 Initializing new Federal Register cache');
        await this.saveMetadata();
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize Federal Register cache:', error.message);
      throw error;
    }
  }

  /**
   * Save metadata to disk
   */
  async saveMetadata() {
    try {
      await fs.writeFile(this.metadataFile, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.error('❌ Failed to save cache metadata:', error.message);
    }
  }

  /**
   * Generate cache key for document
   */
  getCacheKey(documentNumber) {
    return `doc_${documentNumber}`;
  }

  /**
   * Generate cache key for search results
   */
  getSearchCacheKey(cfrCitation, options = {}) {
    const optionsHash = crypto.createHash('md5')
      .update(JSON.stringify(options))
      .digest('hex');
    return `search_${cfrCitation.replace(/\s+/g, '_')}_${optionsHash}`;
  }

  /**
   * Get document file path
   */
  getDocumentPath(documentNumber) {
    return path.join(this.documentsDir, `${documentNumber}.json`);
  }

  /**
   * Get search cache file path
   */
  getSearchCachePath(cacheKey) {
    return path.join(this.searchCacheDir, `${cacheKey}.json`);
  }

  /**
   * Check if document exists in cache and is fresh
   */
  async isDocumentCached(documentNumber) {
    const cacheKey = this.getCacheKey(documentNumber);
    const docMetadata = this.metadata.documents[cacheKey];
    
    if (!docMetadata) return false;
    
    const documentPath = this.getDocumentPath(documentNumber);
    if (!existsSync(documentPath)) {
      // Remove stale metadata
      delete this.metadata.documents[cacheKey];
      await this.saveMetadata();
      return false;
    }
    
    // Check if document is still fresh
    const age = Date.now() - docMetadata.cachedAt;
    return age < this.maxAge;
  }

  /**
   * Get document from cache
   */
  async getCachedDocument(documentNumber) {
    try {
      const documentPath = this.getDocumentPath(documentNumber);
      const content = await fs.readFile(documentPath, 'utf8');
      const document = JSON.parse(content);
      
      console.log(`📋 Retrieved cached Federal Register document: ${documentNumber}`);
      return document;
      
    } catch (error) {
      console.error(`❌ Failed to read cached document ${documentNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Cache document to local storage
   */
  async cacheDocument(documentNumber, document) {
    try {
      const documentPath = this.getDocumentPath(documentNumber);
      const content = JSON.stringify(document, null, 2);
      
      await fs.writeFile(documentPath, content);
      
      // Update metadata
      const cacheKey = this.getCacheKey(documentNumber);
      const stats = await fs.stat(documentPath);
      
      this.metadata.documents[cacheKey] = {
        documentNumber,
        title: document.title || 'Unknown Title',
        publicationDate: document.publication_date,
        cachedAt: Date.now(),
        size: stats.size,
        hash: crypto.createHash('md5').update(content).digest('hex')
      };
      
      this.metadata.stats.totalDocuments = Object.keys(this.metadata.documents).length;
      this.metadata.stats.totalSize += stats.size;
      
      await this.saveMetadata();
      
      console.log(`💾 Cached Federal Register document: ${documentNumber} (${Math.round(stats.size / 1024)}KB)`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to cache document ${documentNumber}:`, error.message);
      return false;
    }
  }

  /**
   * Get document with automatic caching
   */
  async getDocument(documentNumber, forceRefresh = false) {
    // Check cache first unless forcing refresh
    if (!forceRefresh && await this.isDocumentCached(documentNumber)) {
      return await this.getCachedDocument(documentNumber);
    }
    
    try {
      console.log(`🌐 Fetching Federal Register document from API: ${documentNumber}`);
      
      // Fetch from API
      const document = await this.apiClient.fetchDocument(documentNumber);
      
      // Cache the document
      await this.cacheDocument(documentNumber, document);
      
      return document;
      
    } catch (error) {
      console.error(`❌ Failed to fetch document ${documentNumber}:`, error.message);
      
      // Try to return cached version as fallback
      const cached = await this.getCachedDocument(documentNumber);
      if (cached) {
        console.log(`📋 Using stale cached version of document ${documentNumber}`);
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Cache search results
   */
  async cacheSearchResults(cfrCitation, searchResults, options = {}) {
    try {
      const cacheKey = this.getSearchCacheKey(cfrCitation, options);
      const searchPath = this.getSearchCachePath(cacheKey);
      
      const cacheData = {
        cfrCitation,
        options,
        results: searchResults,
        cachedAt: Date.now()
      };
      
      await fs.writeFile(searchPath, JSON.stringify(cacheData, null, 2));
      
      // Update metadata
      this.metadata.searches[cacheKey] = {
        cfrCitation,
        totalCount: searchResults.totalCount,
        cachedAt: Date.now()
      };
      
      await this.saveMetadata();
      
      console.log(`💾 Cached search results for CFR ${cfrCitation}: ${searchResults.totalCount} documents`);
      
    } catch (error) {
      console.error(`❌ Failed to cache search results for ${cfrCitation}:`, error.message);
    }
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(cfrCitation, options = {}) {
    try {
      const cacheKey = this.getSearchCacheKey(cfrCitation, options);
      const searchPath = this.getSearchCachePath(cacheKey);
      
      if (!existsSync(searchPath)) return null;
      
      const content = await fs.readFile(searchPath, 'utf8');
      const cacheData = JSON.parse(content);
      
      // Check if still fresh
      const age = Date.now() - cacheData.cachedAt;
      if (age > this.maxAge) {
        console.log(`⏰ Search cache expired for CFR ${cfrCitation}`);
        return null;
      }
      
      console.log(`📋 Retrieved cached search results for CFR ${cfrCitation}: ${cacheData.results.totalCount} documents`);
      return cacheData.results;
      
    } catch (error) {
      console.error(`❌ Failed to read cached search results for ${cfrCitation}:`, error.message);
      return null;
    }
  }

  /**
   * Search with automatic caching
   */
  async searchByCFRCitation(cfrCitation, options = {}) {
    // Check cache first
    const cached = await this.getCachedSearchResults(cfrCitation, options);
    if (cached) return cached;
    
    try {
      console.log(`🌐 Fetching search results from API for CFR: ${cfrCitation}`);
      
      // Fetch from API
      const searchResults = await this.apiClient.searchByCFRCitation(cfrCitation, options);
      
      // Cache the results
      await this.cacheSearchResults(cfrCitation, searchResults, options);
      
      return searchResults;
      
    } catch (error) {
      console.error(`❌ Failed to search for CFR ${cfrCitation}:`, error.message);
      throw error;
    }
  }

  /**
   * Bulk download documents from search results
   */
  async bulkDownloadDocuments(searchResults, maxDocuments = 50) {
    const documents = searchResults.documents || [];
    const toDownload = documents.slice(0, maxDocuments);
    
    console.log(`📦 Bulk downloading ${toDownload.length} Federal Register documents...`);
    
    const results = {
      downloaded: 0,
      cached: 0,
      failed: 0,
      documents: []
    };
    
    for (const doc of toDownload) {
      try {
        const isCached = await this.isDocumentCached(doc.document_number);
        
        if (isCached) {
          const cachedDoc = await this.getCachedDocument(doc.document_number);
          results.cached++;
          results.documents.push(cachedDoc);
        } else {
          const fullDoc = await this.getDocument(doc.document_number);
          results.downloaded++;
          results.documents.push(fullDoc);
        }
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to download document ${doc.document_number}:`, error.message);
        results.failed++;
      }
    }
    
    console.log(`✅ Bulk download complete: ${results.downloaded} downloaded, ${results.cached} cached, ${results.failed} failed`);
    return results;
  }

  /**
   * Check for document updates
   */
  async checkForUpdates(documentNumbers = []) {
    const updates = [];
    
    for (const documentNumber of documentNumbers) {
      try {
        const cacheKey = this.getCacheKey(documentNumber);
        const docMetadata = this.metadata.documents[cacheKey];
        
        if (!docMetadata) continue;
        
        // Fetch current document info (lightweight)
        const currentDoc = await this.apiClient.fetchDocument(documentNumber);
        const currentHash = crypto.createHash('md5')
          .update(JSON.stringify(currentDoc))
          .digest('hex');
        
        if (currentHash !== docMetadata.hash) {
          updates.push({
            documentNumber,
            oldHash: docMetadata.hash,
            newHash: currentHash,
            title: currentDoc.title
          });
          
          // Update the cached document
          await this.cacheDocument(documentNumber, currentDoc);
        }
        
      } catch (error) {
        console.error(`❌ Failed to check updates for document ${documentNumber}:`, error.message);
      }
    }
    
    if (updates.length > 0) {
      console.log(`🔄 Found ${updates.length} document updates`);
    }
    
    return updates;
  }

  /**
   * Clean up old cache entries
   */
  async cleanup() {
    try {
      console.log('🧹 Starting Federal Register cache cleanup...');
      
      let removedCount = 0;
      let freedSpace = 0;
      
      // Remove expired documents
      for (const [cacheKey, docMetadata] of Object.entries(this.metadata.documents)) {
        const age = Date.now() - docMetadata.cachedAt;
        
        if (age > this.maxAge * 2) { // Remove documents older than 2x maxAge
          const documentPath = this.getDocumentPath(docMetadata.documentNumber);
          
          try {
            const stats = await fs.stat(documentPath);
            await fs.unlink(documentPath);
            
            freedSpace += stats.size;
            removedCount++;
            delete this.metadata.documents[cacheKey];
            
          } catch (error) {
            // File might already be deleted
            delete this.metadata.documents[cacheKey];
          }
        }
      }
      
      // Update stats
      this.metadata.stats.totalDocuments = Object.keys(this.metadata.documents).length;
      this.metadata.stats.totalSize -= freedSpace;
      this.metadata.stats.lastCleanup = Date.now();
      
      await this.saveMetadata();
      
      console.log(`✅ Cache cleanup complete: removed ${removedCount} documents, freed ${Math.round(freedSpace / 1024)}KB`);
      
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      ...this.metadata.stats,
      totalDocuments: Object.keys(this.metadata.documents).length,
      totalSearches: Object.keys(this.metadata.searches).length,
      cacheDir: this.cacheDir,
      maxAge: this.maxAge,
      maxDocuments: this.maxDocuments
    };
  }

  /**
   * Sync all cached documents (check for updates)
   */
  async syncAll() {
    console.log('🔄 Starting full Federal Register cache sync...');
    
    const documentNumbers = Object.values(this.metadata.documents)
      .map(doc => doc.documentNumber);
    
    if (documentNumbers.length === 0) {
      console.log('📭 No documents to sync');
      return { updates: [], errors: [] };
    }
    
    const updates = await this.checkForUpdates(documentNumbers);
    
    this.metadata.lastSync = Date.now();
    await this.saveMetadata();
    
    console.log(`✅ Sync complete: ${updates.length} updates found`);
    return { updates, errors: [] };
  }
}

export default FederalRegisterCache;
