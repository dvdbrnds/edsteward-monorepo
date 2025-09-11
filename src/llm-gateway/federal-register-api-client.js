/**
 * Federal Register API Client
 * 
 * Integrates with Federal Register API to enhance CFR regulation data
 * with comprehensive regulatory context, preambles, and implementation guidance
 * 
 * API Documentation: https://www.federalregister.gov/developers/api/v1
 */

import https from 'https';
import http from 'http';

export class FederalRegisterAPIClient {
  constructor(options = {}) {
    this.baseUrl = 'https://www.federalregister.gov/api/v1';
    this.cache = new Map();
    this.cacheDuration = options.cacheDuration || 3600000; // 1 hour default
    this.timeout = options.timeout || 30000; // 30 seconds
    this.userAgent = 'MCP-Engine-Federal-Register-Client/1.0';
  }

  /**
   * HTTP GET utility method with proper error handling
   */
  async httpGet(url, options = {}) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      const timeoutMs = options.timeout || this.timeout;
      
      console.log(`🌐 Federal Register API: GET ${url}`);
      
      const request = protocol.get(url, {
        timeout: timeoutMs,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          ...options.headers
        }
      }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          // Check if response should be parsed as JSON based on content type or URL
          const contentType = response.headers['content-type'] || '';
          const isJsonResponse = contentType.includes('application/json') || url.includes('.json');
          
          if (isJsonResponse) {
            try {
              const jsonData = JSON.parse(data);
              resolve({
                status: response.statusCode,
                data: jsonData,
                headers: response.headers
              });
            } catch (parseError) {
              console.error(`❌ JSON parse error for ${url}:`, parseError.message);
              resolve({
                status: response.statusCode,
                data: { error: 'Invalid JSON response', raw: data },
                headers: response.headers
              });
            }
          } else {
            // Return raw text data
            resolve({
              status: response.statusCode,
              data: data,
              headers: response.headers
            });
          }
        });
      });
      
      request.on('error', (error) => {
        console.error(`❌ Federal Register API request failed for ${url}:`, error.message);
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Request timeout for ${url} after ${timeoutMs}ms`));
      });
    });
  }

  /**
   * Parse CFR citation to extract title and part numbers
   * Examples: "34 CFR 668.14" -> {title: 34, part: 668}
   *          "17 CFR 110.2" -> {title: 17, part: 110}
   */
  parseCFRCitation(cfrText) {
    // Multiple patterns to handle various CFR citation formats
    const patterns = [
      /(\d+)\s+CFR\s+(\d+)\.?\d*/i,           // "34 CFR 668.14"
      /CFR\s+Title\s+(\d+),?\s+Part\s+(\d+)/i, // "CFR Title 34, Part 668"
      /Title\s+(\d+),?\s+Part\s+(\d+)/i,       // "Title 34, Part 668"
      /(\d+)\s+C\.F\.R\.?\s+§?\s*(\d+)/i       // "34 C.F.R. § 668"
    ];

    for (const pattern of patterns) {
      const match = cfrText.match(pattern);
      if (match) {
        return {
          title: parseInt(match[1]),
          part: parseInt(match[2])
        };
      }
    }

    console.log(`⚠️ Could not parse CFR citation from: "${cfrText}"`);
    return null;
  }

  /**
   * Search Federal Register for documents related to CFR citation
   */
  async searchByCFRCitation(cfrCitation, options = {}) {
    const parsed = this.parseCFRCitation(cfrCitation);
    if (!parsed) {
      throw new Error(`Invalid CFR citation format: ${cfrCitation}`);
    }

    const cacheKey = `cfr_search_${parsed.title}_${parsed.part}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        console.log(`📋 Using cached Federal Register search for CFR ${parsed.title} Part ${parsed.part}`);
        return cached.data;
      }
    }

    try {
      // Build search URL with CFR conditions
      const searchParams = new URLSearchParams({
        'conditions[cfr][title]': parsed.title.toString(),
        'conditions[cfr][part]': parsed.part.toString(),
        'per_page': options.limit || 20,
        'page': options.page || 1,
        'order': 'newest' // Get most recent documents first
      });

      // Add date range if specified
      if (options.startDate) {
        searchParams.append('conditions[publication_date][gte]', options.startDate);
      }
      if (options.endDate) {
        searchParams.append('conditions[publication_date][lte]', options.endDate);
      }

      const searchUrl = `${this.baseUrl}/articles.json?${searchParams.toString()}`;
      const response = await this.httpGet(searchUrl);

      if (response.status !== 200) {
        throw new Error(`Federal Register API returned status ${response.status}`);
      }

      const searchResults = {
        query: { title: parsed.title, part: parsed.part },
        totalCount: response.data.count || 0,
        documents: response.data.results || [],
        searchUrl: searchUrl
      };

      // Cache the results
      this.cache.set(cacheKey, {
        data: searchResults,
        timestamp: Date.now()
      });

      console.log(`✅ Found ${searchResults.totalCount} Federal Register documents for CFR ${parsed.title} Part ${parsed.part}`);
      return searchResults;

    } catch (error) {
      console.error(`❌ Federal Register search failed for CFR ${parsed.title} Part ${parsed.part}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch full document by document number
   */
  async fetchDocument(documentNumber, options = {}) {
    const cacheKey = `document_${documentNumber}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        console.log(`📋 Using cached Federal Register document ${documentNumber}`);
        return cached.data;
      }
    }

    try {
      const documentUrl = `${this.baseUrl}/articles/${documentNumber}.json`;
      const response = await this.httpGet(documentUrl);

      if (response.status !== 200) {
        throw new Error(`Federal Register API returned status ${response.status} for document ${documentNumber}`);
      }

      const document = response.data;

      // Fetch full text if available
      if (document.raw_text_url && options.includeFullText !== false) {
        try {
          console.log(`📄 Fetching full text from: ${document.raw_text_url}`);
          const textResponse = await this.httpGet(document.raw_text_url);
          
          if (textResponse.status === 200) {
            // Clean up the HTML wrapper and extract plain text
            let fullText = textResponse.data;
            
            // Remove HTML tags and decode entities
            fullText = fullText
              .replace(/<[^>]*>/g, '') // Remove HTML tags
              .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
              .replace(/&amp;/g, '&')  // Decode HTML entities
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .trim();
            
            document.full_text = fullText;
            console.log(`✅ Added full text to document ${documentNumber} (${fullText.length} characters)`);
          } else {
            console.warn(`⚠️ Could not fetch full text for document ${documentNumber}: HTTP ${textResponse.status}`);
          }
        } catch (textError) {
          console.warn(`⚠️ Failed to fetch full text for document ${documentNumber}:`, textError.message);
          // Continue without full text - don't fail the entire document fetch
        }
      }

      // Cache the document (with or without full text)
      this.cache.set(cacheKey, {
        data: document,
        timestamp: Date.now()
      });

      console.log(`✅ Fetched Federal Register document ${documentNumber}: "${document.title}"`);
      return document;

    } catch (error) {
      console.error(`❌ Failed to fetch Federal Register document ${documentNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Get comprehensive regulation context by combining CFR search results
   */
  async getRegulationContext(cfrCitation, options = {}) {
    try {
      console.log(`🔍 Getting comprehensive Federal Register context for: ${cfrCitation}`);
      
      // Search for related documents
      const searchResults = await this.searchByCFRCitation(cfrCitation, {
        limit: options.documentLimit || 10,
        startDate: options.startDate,
        endDate: options.endDate
      });

      if (searchResults.totalCount === 0) {
        console.log(`⚠️ No Federal Register documents found for CFR citation: ${cfrCitation}`);
        return {
          cfrCitation,
          foundDocuments: false,
          context: null,
          searchResults
        };
      }

      // Get detailed information for the most relevant documents
      const detailedDocuments = [];
      const documentsToFetch = Math.min(
        searchResults.documents.length, 
        options.detailLimit || 3
      );

      for (let i = 0; i < documentsToFetch; i++) {
        const doc = searchResults.documents[i];
        try {
          const fullDocument = await this.fetchDocument(doc.document_number, { includeFullText: true });
          detailedDocuments.push({
            document_number: doc.document_number,
            title: doc.title,
            publication_date: doc.publication_date,
            type: doc.type,
            agency_names: doc.agency_names,
            abstract: doc.abstract,
            full_text_xml_url: doc.full_text_xml_url,
            html_url: doc.html_url,
            pdf_url: doc.pdf_url,
            // Full document content
            full_text: fullDocument.full_text,
            body: fullDocument.body,
            raw_text: fullDocument.raw_text,
            preamble: this.extractPreamble(fullDocument),
            regulatory_context: this.extractRegulatoryContext(fullDocument)
          });
        } catch (docError) {
          console.error(`⚠️ Failed to fetch details for document ${doc.document_number}:`, docError.message);
          // Continue with basic info
          detailedDocuments.push(doc);
        }
      }

      const context = {
        cfrCitation,
        foundDocuments: true,
        totalDocuments: searchResults.totalCount,
        detailedDocuments,
        searchResults,
        enhancedContent: this.buildEnhancedContent(detailedDocuments),
        generatedAt: new Date().toISOString()
      };

      console.log(`✅ Built comprehensive Federal Register context with ${detailedDocuments.length} detailed documents`);
      return context;

    } catch (error) {
      console.error(`❌ Failed to get Federal Register context for ${cfrCitation}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract preamble content from Federal Register document
   */
  extractPreamble(document) {
    if (!document.body && !document.raw_text) {
      return null;
    }

    const content = document.body || document.raw_text || '';
    
    // Look for common preamble sections
    const preamblePatterns = [
      /SUMMARY:\s*(.*?)(?=DATES:|FOR FURTHER INFORMATION|SUPPLEMENTARY INFORMATION|$)/s,
      /AGENCY:\s*(.*?)(?=ACTION:|SUMMARY:|$)/s,
      /ACTION:\s*(.*?)(?=SUMMARY:|DATES:|$)/s,
      /DATES:\s*(.*?)(?=ADDRESSES:|FOR FURTHER INFORMATION|SUPPLEMENTARY INFORMATION|$)/s
    ];

    const preamble = {};
    
    for (const pattern of preamblePatterns) {
      const match = content.match(pattern);
      if (match) {
        const sectionName = pattern.source.split(':')[0].replace(/[^\w]/g, '').toLowerCase();
        preamble[sectionName] = match[1].trim();
      }
    }

    return Object.keys(preamble).length > 0 ? preamble : null;
  }

  /**
   * Extract regulatory context and implementation guidance
   */
  extractRegulatoryContext(document) {
    if (!document.body && !document.raw_text) {
      return null;
    }

    const content = document.body || document.raw_text || '';
    
    // Look for implementation guidance sections
    const contextPatterns = [
      /SUPPLEMENTARY INFORMATION:\s*(.*?)(?=List of Subjects|Regulatory Analysis|$)/s,
      /BACKGROUND:\s*(.*?)(?=DISCUSSION|ANALYSIS|REGULATORY|$)/s,
      /DISCUSSION:\s*(.*?)(?=REGULATORY|ANALYSIS|EFFECTIVE DATE|$)/s,
      /REGULATORY ANALYSIS:\s*(.*?)(?=PAPERWORK REDUCTION|UNFUNDED MANDATES|$)/s
    ];

    const context = {};
    
    for (const pattern of contextPatterns) {
      const match = content.match(pattern);
      if (match) {
        const sectionName = pattern.source.split(':')[0].replace(/[^\w\s]/g, '').toLowerCase().replace(/\s+/g, '_');
        context[sectionName] = match[1].trim();
      }
    }

    return Object.keys(context).length > 0 ? context : null;
  }

  /**
   * Build enhanced content combining all Federal Register information
   */
  buildEnhancedContent(detailedDocuments) {
    if (!detailedDocuments || detailedDocuments.length === 0) {
      return null;
    }

    const enhanced = {
      summary: '',
      implementation_guidance: '',
      regulatory_history: [],
      key_provisions: [],
      compliance_requirements: []
    };

    for (const doc of detailedDocuments) {
      // Build summary from abstracts
      if (doc.abstract) {
        enhanced.summary += `\n\n**${doc.title}** (${doc.publication_date})\n${doc.abstract}`;
      }

      // Extract implementation guidance from preambles
      if (doc.preamble) {
        if (doc.preamble.summary) {
          enhanced.implementation_guidance += `\n\n**Regulatory Summary**: ${doc.preamble.summary}`;
        }
        if (doc.preamble.dates) {
          enhanced.implementation_guidance += `\n\n**Important Dates**: ${doc.preamble.dates}`;
        }
      }

      // Build regulatory history
      enhanced.regulatory_history.push({
        date: doc.publication_date,
        title: doc.title,
        type: doc.type,
        document_number: doc.document_number,
        agencies: doc.agency_names
      });

      // Extract key provisions from regulatory context
      if (doc.regulatory_context) {
        Object.entries(doc.regulatory_context).forEach(([section, content]) => {
          enhanced.key_provisions.push({
            section: section.replace(/_/g, ' ').toUpperCase(),
            content: content.substring(0, 500) + (content.length > 500 ? '...' : '')
          });
        });
      }
    }

    return enhanced;
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Federal Register API cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default FederalRegisterAPIClient;
