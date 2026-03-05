/**
 * Enhanced Regulation Processor
 * 
 * Combines CFR regulation text with Federal Register context to create
 * comprehensive regulation packages for EdSteward transmission
 */

import FederalRegisterAPIClient from './federal-register-api-client.js';
import FederalRegisterCache from './federal-register-cache.js';

export class EnhancedRegulationProcessor {
  constructor(options = {}) {
    this.federalRegisterClient = new FederalRegisterAPIClient(options.federalRegister);
    
    // Initialize cache system if enabled
    this.useCacheSystem = options.enableCache !== false;
    if (this.useCacheSystem) {
      try {
        this.federalRegisterCache = new FederalRegisterCache(options.cache);
        console.log('✅ Federal Register cache system enabled');
      } catch (error) {
        console.warn('⚠️ Failed to initialize cache system, falling back to direct API:', error.message);
        this.useCacheSystem = false;
      }
    }
    
    this.cache = new Map();
    this.cacheDuration = options.cacheDuration || 1800000; // 30 minutes
  }

  /**
   * Extract CFR citations from regulation text
   */
  extractCFRCitations(regulationText, regulationTitle = '') {
    const citations = new Set();
    
    // Common CFR citation patterns
    const patterns = [
      /(\d+)\s+CFR\s+(\d+(?:\.\d+)*)/gi,           // "34 CFR 668.14"
      /(\d+)\s+C\.F\.R\.?\s+§?\s*(\d+(?:\.\d+)*)/gi, // "34 C.F.R. § 668.14"
      /CFR\s+Title\s+(\d+),?\s+Part\s+(\d+)/gi,    // "CFR Title 34, Part 668"
      /Title\s+(\d+),?\s+Part\s+(\d+)/gi           // "Title 34, Part 668"
    ];

    const textToSearch = `${regulationTitle} ${regulationText}`;
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(textToSearch)) !== null) {
        const title = match[1];
        const part = match[2].split('.')[0]; // Get just the part number
        citations.add(`${title} CFR ${part}`);
      }
    }

    // Also check for known regulation-specific CFR mappings
    const knownMappings = this.getKnownCFRMappings();
    for (const [regPattern, cfrCitation] of Object.entries(knownMappings)) {
      if (textToSearch.toLowerCase().includes(regPattern.toLowerCase())) {
        citations.add(cfrCitation);
      }
    }

    return Array.from(citations);
  }

  /**
   * Known regulation to CFR mappings for common educational regulations
   */
  getKnownCFRMappings() {
    return {
      'TEACH Act': '37 CFR 201',
      'Technology, Education and Copyright Harmonization': '37 CFR 201',
      'FERPA': '34 CFR 99',
      'Family Educational Rights and Privacy': '34 CFR 99',
      'Title IX': '34 CFR 106',
      'Clery Act': '34 CFR 668',
      'Campus Security': '34 CFR 668',
      'ADA': '28 CFR 35',
      'Americans with Disabilities': '28 CFR 35',
      'Section 504': '34 CFR 104',
      'Rehabilitation Act': '34 CFR 104'
    };
  }

  /**
   * Process regulation with Federal Register enhancement
   */
  async processRegulation(regulationData, options = {}) {
    const startTime = Date.now();
    console.log(`🔄 Processing regulation with Federal Register enhancement: ${regulationData.title || 'Unknown'}`);

    try {
      // Extract base regulation information
      const baseRegulation = {
        title: regulationData.title || 'Unknown Regulation',
        content: regulationData.fullText || regulationData.content || '',
        source: regulationData.source || 'CFR',
        originalData: regulationData
      };

      // Extract CFR citations from the regulation
      const cfrCitations = this.extractCFRCitations(
        baseRegulation.content, 
        baseRegulation.title
      );

      console.log(`📋 Found ${cfrCitations.length} CFR citations: ${cfrCitations.join(', ')}`);

      // Get Federal Register context for each CFR citation
      const federalRegisterContexts = [];
      const allDocuments = [];
      let totalDocumentsReferenced = 0;
      
      for (const citation of cfrCitations) {
        try {
          console.log(`🔍 Getting Federal Register context for: ${citation}`);
          
          if (this.useCacheSystem && this.federalRegisterCache) {
            // Use cache system
            const searchResults = await this.federalRegisterCache.searchByCFRCitation(citation, {
              limit: options.documentLimit || 50,
              startDate: options.startDate || '2020-01-01'
            });

            if (searchResults.totalCount > 0) {
              totalDocumentsReferenced += searchResults.totalCount;
              
              // Store all documents for "show all" feature
              allDocuments.push(...searchResults.documents);
              
              // Get detailed documents using cache
              const detailLimit = options.detailLimit || 3;
              const documentsToProcess = searchResults.documents.slice(0, detailLimit);
              
              const detailedDocuments = [];
              for (const doc of documentsToProcess) {
                try {
                  const fullDocument = await this.federalRegisterCache.getDocument(doc.document_number);
                  
                  detailedDocuments.push({
                    document_number: doc.document_number,
                    title: doc.title,
                    publication_date: doc.publication_date,
                    type: doc.type,
                    abstract: doc.abstract,
                    full_text: fullDocument.full_text || fullDocument.body_html || '',
                    url: `https://www.federalregister.gov/documents/${doc.document_number}`,
                    cached: true
                  });
                  
                } catch (error) {
                  console.error(`❌ Failed to get cached document ${doc.document_number}:`, error.message);
                }
              }
              
              if (detailedDocuments.length > 0) {
                federalRegisterContexts.push({
                  cfrCitation: citation,
                  foundDocuments: true,
                  detailedDocuments: detailedDocuments,
                  searchResults: searchResults
                });
              }
              
              console.log(`✅ Found ${detailedDocuments.length} detailed documents for CFR ${citation} (${searchResults.totalCount} total)`);
            } else {
              console.log(`⚠️ No documents found for CFR ${citation}`);
            }
            
          } else {
            // Fallback to direct API client
            console.log(`🌐 Using direct API for: ${citation}`);
            const context = await this.federalRegisterClient.getRegulationContext(citation, {
              documentLimit: options.documentLimit || 5,
              detailLimit: options.detailLimit || 2,
              startDate: options.startDate,
              endDate: options.endDate
            });
            
            if (context.foundDocuments) {
              totalDocumentsReferenced += context.searchResults?.totalCount || 0;
              allDocuments.push(...(context.searchResults?.documents || []));
              federalRegisterContexts.push(context);
              console.log(`✅ Found ${context.detailedDocuments?.length || 0} detailed documents for CFR ${citation}`);
            }
          }
          
        } catch (contextError) {
          console.error(`⚠️ Failed to get Federal Register context for ${citation}:`, contextError.message);
          // Continue processing other citations
        }
      }

      // Build enhanced regulation package
      const enhancedRegulation = this.buildEnhancedPackage(
        baseRegulation, 
        federalRegisterContexts,
        {
          ...options,
          totalDocumentsReferenced,
          allDocuments: options.showAllDocuments ? allDocuments : []
        }
      );

      const processingTime = Date.now() - startTime;
      console.log(`✅ Enhanced regulation processing completed in ${processingTime}ms`);
      console.log(`📊 Enhancement stats: ${federalRegisterContexts.length} Federal Register contexts, ${enhancedRegulation.regulation_text.length} chars total`);

      return enhancedRegulation;

    } catch (error) {
      console.error(`❌ Enhanced regulation processing failed:`, error.message);
      
      // Return basic regulation data as fallback
      return {
        regulation_text: regulationData.fullText || regulationData.content || '',
        summary: regulationData.summary || 'Summary not available',
        submission_guidelines: 'Standard compliance submission guidelines apply',
        requirements: regulationData.keyRequirements || [],
        source_attribution: 'CFR (Federal Register enhancement failed)',
        federal_register_enhancement: {
          attempted: true,
          successful: false,
          error: error.message,
          fallback_used: true
        },
        processing_metadata: {
          processed_at: new Date().toISOString(),
          enhancement_attempted: true,
          enhancement_successful: false
        }
      };
    }
  }

  /**
   * Build comprehensive enhanced regulation package
   */
  buildEnhancedPackage(baseRegulation, federalRegisterContexts, options = {}) {
    // Start with base CFR content
    let enhancedText = `# ${baseRegulation.title}\n\n`;
    enhancedText += `**Source**: ${baseRegulation.source}\n\n`;
    enhancedText += `## CFR Regulation Text\n\n${baseRegulation.content}\n\n`;

    // Add Federal Register context
    if (federalRegisterContexts.length > 0) {
      enhancedText += `## Federal Register Context and Implementation Guidance\n\n`;
      enhancedText += `*This section provides additional regulatory context, preambles, and implementation guidance from the Federal Register that supplements the CFR text above.*\n\n`;

      for (const context of federalRegisterContexts) {
        enhancedText += `### CFR Citation: ${context.cfrCitation}\n\n`;
        
        if (context.enhancedContent) {
          // Add summary
          if (context.enhancedContent.summary) {
            enhancedText += `**Regulatory Background and Summary**:\n${context.enhancedContent.summary}\n\n`;
          }

          // Add implementation guidance
          if (context.enhancedContent.implementation_guidance) {
            enhancedText += `**Implementation Guidance**:\n${context.enhancedContent.implementation_guidance}\n\n`;
          }

          // Add key provisions
          if (context.enhancedContent.key_provisions && context.enhancedContent.key_provisions.length > 0) {
            enhancedText += `**Key Regulatory Provisions**:\n`;
            for (const provision of context.enhancedContent.key_provisions) {
              enhancedText += `- **${provision.section}**: ${provision.content}\n`;
            }
            enhancedText += `\n`;
          }

          // Add regulatory history
          if (context.enhancedContent.regulatory_history && context.enhancedContent.regulatory_history.length > 0) {
            enhancedText += `**Regulatory History**:\n`;
            for (const historyItem of context.enhancedContent.regulatory_history) {
              enhancedText += `- ${historyItem.date}: ${historyItem.title} (${historyItem.type}) - Document ${historyItem.document_number}\n`;
            }
            enhancedText += `\n`;
          }
        }

        // Add document references
        if (context.detailedDocuments && context.detailedDocuments.length > 0) {
          enhancedText += `**Related Federal Register Documents**:\n`;
          for (const doc of context.detailedDocuments) {
            enhancedText += `- [${doc.title}](${doc.html_url || '#'}) (${doc.publication_date}) - Document ${doc.document_number}\n`;
            if (doc.abstract) {
              enhancedText += `  *${doc.abstract.substring(0, 200)}${doc.abstract.length > 200 ? '...' : ''}*\n`;
            }
          }
          enhancedText += `\n`;
        }
      }
    }

    // Build comprehensive requirements list
    const requirements = [];
    
    // Add base regulation requirements
    if (baseRegulation.originalData.keyRequirements) {
      requirements.push(...baseRegulation.originalData.keyRequirements);
    }

    // Add Federal Register derived requirements
    for (const context of federalRegisterContexts) {
      if (context.enhancedContent && context.enhancedContent.compliance_requirements) {
        requirements.push(...context.enhancedContent.compliance_requirements);
      }
    }

    // Generate enhanced summary
    const summary = this.generateEnhancedSummary(baseRegulation, federalRegisterContexts);

    // Generate submission guidelines
    const submissionGuidelines = this.generateSubmissionGuidelines(baseRegulation, federalRegisterContexts);

    return {
      regulation_text: enhancedText,
      summary: summary,
      submission_guidelines: submissionGuidelines,
      requirements: [...new Set(requirements)], // Remove duplicates
      source_attribution: 'MCP Engine + Federal Register',
      federal_register_enhancement: {
        attempted: true,
        successful: federalRegisterContexts.length > 0,
        contexts_found: federalRegisterContexts.length,
        cfr_citations_processed: federalRegisterContexts.map(c => c.cfrCitation || c.cfrCitation),
        total_documents_referenced: options.totalDocumentsReferenced || federalRegisterContexts.reduce((sum, c) => sum + (c.totalDocuments || c.searchResults?.totalCount || 0), 0),
        contexts: federalRegisterContexts.flatMap(c => c.detailedDocuments || []),
        all_documents: options.allDocuments || federalRegisterContexts.flatMap(c => c.searchResults?.documents || [])
      },
      processing_metadata: {
        processed_at: new Date().toISOString(),
        enhancement_attempted: true,
        enhancement_successful: federalRegisterContexts.length > 0,
        cfr_citations_found: federalRegisterContexts.map(c => c.cfrCitation)
      }
    };
  }

  /**
   * Generate enhanced summary combining CFR and Federal Register content
   */
  generateEnhancedSummary(baseRegulation, federalRegisterContexts) {
    let summary = `This regulation combines CFR codified requirements with Federal Register implementation guidance and regulatory context.\n\n`;
    
    // Add base regulation summary
    if (baseRegulation.originalData.summary) {
      summary += `**CFR Summary**: ${baseRegulation.originalData.summary}\n\n`;
    }

    // Add Federal Register insights
    if (federalRegisterContexts.length > 0) {
      summary += `**Federal Register Context**: This regulation is supported by ${federalRegisterContexts.length} Federal Register document context(s) providing implementation guidance, regulatory background, and compliance requirements beyond the basic CFR text.\n\n`;
      
      for (const context of federalRegisterContexts) {
        if (context.enhancedContent && context.enhancedContent.summary) {
          const contextSummary = context.enhancedContent.summary.substring(0, 300);
          summary += `**${context.cfrCitation} Context**: ${contextSummary}${context.enhancedContent.summary.length > 300 ? '...' : ''}\n\n`;
        }
      }
    }

    return summary;
  }

  /**
   * Generate comprehensive submission guidelines
   */
  generateSubmissionGuidelines(baseRegulation, federalRegisterContexts) {
    let guidelines = `# Compliance Submission Guidelines\n\n`;
    guidelines += `This regulation requires compliance with both CFR codified requirements and Federal Register implementation guidance.\n\n`;
    
    guidelines += `## Required Documentation\n`;
    guidelines += `- Evidence of compliance with CFR requirements\n`;
    guidelines += `- Implementation of Federal Register guidance where applicable\n`;
    guidelines += `- Documentation of regulatory compliance procedures\n\n`;

    if (federalRegisterContexts.length > 0) {
      guidelines += `## Federal Register Implementation Requirements\n`;
      guidelines += `This regulation is enhanced with Federal Register context covering:\n`;
      
      for (const context of federalRegisterContexts) {
        guidelines += `- **${context.cfrCitation}**: ${context.totalDocuments} related Federal Register documents\n`;
      }
      guidelines += `\n`;
    }

    guidelines += `## Submission Process\n`;
    guidelines += `1. Review both CFR requirements and Federal Register implementation guidance\n`;
    guidelines += `2. Prepare comprehensive compliance documentation\n`;
    guidelines += `3. Submit through appropriate regulatory channels\n`;
    guidelines += `4. Maintain records for regulatory review\n\n`;

    guidelines += `*This guidance combines CFR regulatory text with Federal Register implementation context for comprehensive compliance.*`;

    return guidelines;
  }

  /**
   * Clear processing cache
   */
  clearCache() {
    this.cache.clear();
    this.federalRegisterClient.clearCache();
    console.log('🧹 Enhanced regulation processor cache cleared');
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      processorCache: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys())
      },
      federalRegisterClient: this.federalRegisterClient.getCacheStats()
    };
  }
}

export default EnhancedRegulationProcessor;

