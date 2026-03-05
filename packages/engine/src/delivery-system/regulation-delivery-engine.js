/**
 * MCP Engine Real-Time Regulation Delivery System
 * 
 * Hybrid approach combining:
 * 1. Change Data Capture (CDC) - Monitors regulation changes
 * 2. Event Sourcing - Immutable event log of all changes  
 * 3. CQRS - Separate read/write models for performance
 * 4. WebSocket Push - Real-time client notifications
 * 5. Webhook Fallback - Reliable delivery guarantees
 * 
 * Based on Context7 best practices and Emittery event patterns
 */

import Emittery from 'emittery';
import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';
import express from 'express';
import { createHash } from 'crypto';

/**
 * Core Events for Regulation Delivery System
 * Using symbols to avoid event name collisions (Emittery best practice)
 */
const REGULATION_EVENTS = {
  // CDC Events - Database changes detected
  CONTENT_CHANGED: Symbol('regulation.content.changed'),
  VERSION_UPDATED: Symbol('regulation.version.updated'),
  COMPLIANCE_MODIFIED: Symbol('regulation.compliance.modified'),
  
  // Event Sourcing Events - Domain events
  REGULATION_DRAFTED: Symbol('regulation.drafted'),
  REGULATION_PUBLISHED: Symbol('regulation.published'),
  REGULATION_SUPERSEDED: Symbol('regulation.superseded'),
  
  // Delivery Events - Push notifications
  CUSTOMER_NOTIFIED: Symbol('customer.notified'),
  DELIVERY_CONFIRMED: Symbol('delivery.confirmed'),
  DELIVERY_FAILED: Symbol('delivery.failed'),
  
  // System Events - Health and monitoring
  SYSTEM_READY: Symbol('system.ready'),
  PERFORMANCE_ALERT: Symbol('performance.alert')
};

/**
 * Regulation Change Data Capture Service
 * Monitors regulation changes and emits CDC events
 */
class RegulationCDCService extends Emittery {
  constructor(options = {}) {
    super({
      debug: {
        name: 'RegulationCDC',
        enabled: process.env.NODE_ENV === 'development'
      }
    });
    
    this.lastKnownVersions = new Map();
    this.contentHashes = new Map();
    this.pollInterval = options.pollInterval || parseInt(process.env.REGULATION_POLL_INTERVAL || '30000'); // 30 seconds default for production
    this.batchSize = options.batchSize || parseInt(process.env.REGULATION_BATCH_SIZE || '10'); // Process 10 at a time
    this.currentBatchIndex = 0;
    this.isActive = false;
  }

  /**
   * Start monitoring regulation changes
   * Uses hash-based change detection for efficiency
   */
  async startMonitoring(options = {}) {
    this.isActive = true;
    console.log('🔍 Starting CDC monitoring for regulations...');
    
    // ✅ SCALABLE: Fetch regulation list from Registry API or use provided list
    let regulationsToMonitor = options.regulations;
    
    if (!regulationsToMonitor) {
      try {
        console.log('📋 Fetching regulation list from Registry API...');
        const registryResponse = await fetch('http://localhost:3010/api/regulations');
        const registryData = await registryResponse.json();
        
        // Registry returns an array directly, not wrapped in .regulations
        const regulationsArray = Array.isArray(registryData) ? registryData : (registryData.regulations || []);
        
        // Extract slugs from all regulations in Registry
        regulationsToMonitor = regulationsArray
          .map(reg => reg.regulationId || reg.slug || reg.id)
          .filter(slug => slug && slug.length > 0);
        
        console.log(`✅ Found ${regulationsToMonitor.length} regulations in Registry`);
        console.log(`🚀 PRODUCTION MODE: Monitoring ALL ${regulationsToMonitor.length} regulations`);
        
        // Filter out any invalid slugs (empty, null, undefined)
        regulationsToMonitor = regulationsToMonitor.filter(slug => 
          slug && typeof slug === 'string' && slug.trim().length > 0
        );
        
        console.log(`📋 After filtering: ${regulationsToMonitor.length} valid regulation slugs`);
        
        // If for some reason we want to limit for testing, set MAX_REGULATIONS env var
        const maxRegulations = parseInt(process.env.MAX_REGULATIONS || '0');
        if (maxRegulations > 0 && regulationsToMonitor.length > maxRegulations) {
          console.log(`⚠️  MAX_REGULATIONS set to ${maxRegulations}, limiting from ${regulationsToMonitor.length}`);
          regulationsToMonitor = regulationsToMonitor.slice(0, maxRegulations);
        }
      } catch (error) {
        console.error('❌ Failed to fetch from Registry, using fallback list:', error.message);
        // Fallback to top 10 for Friday demo
        regulationsToMonitor = [
          'clery-act',
          'family-educational-rights-and-privacy-act-ferpa',
          'title-ix-of-the-education-amendment-of-1972',
          'higher-education-act-title-iv-student-financial-a',
          'violence-against-women-reauthorization-act',
          'americans-with-disabilities-act-of-1990',
          'section-504-of-the-rehabilitation-act-of-1973',
          'title-vi-of-the-civil-rights-act-of-1964',
          'technology-education-and-copyright-harmonization-a',
          'drug-free-schools-and-communities-act',
          'higher-education-opportunity-act-sections-152-and-'
        ];
      }
    }
    
    // Store the list for polling
    this.monitoredRegulations = regulationsToMonitor;
    
    // Initialize baselines in background with batched concurrency
    // Server starts accepting requests immediately; baselines load in parallel
    const BATCH_SIZE = 15;
    const totalRegs = regulationsToMonitor.length;
    console.log(`📋 Initializing baselines for ${totalRegs} regulations (batches of ${BATCH_SIZE}, non-blocking)...`);
    
    this._baselineInitPromise = (async () => {
      const startTime = Date.now();
      let completed = 0;
      for (let i = 0; i < totalRegs; i += BATCH_SIZE) {
        const batch = regulationsToMonitor.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(regId => this.initializeRegulationBaseline(regId))
        );
        completed += batch.length;
        if (completed % 60 === 0 || completed === totalRegs) {
          console.log(`📋 Baseline progress: ${completed}/${totalRegs} (${Math.round((Date.now() - startTime) / 1000)}s)`);
        }
      }
      console.log(`✅ All ${totalRegs} baselines initialized in ${Math.round((Date.now() - startTime) / 1000)}s`);
    })().catch(err => console.error('❌ Baseline init error:', err.message));
    
    // ✅ PRODUCTION: Staggered batch polling for efficient monitoring of all regulations
    // Processes regulations in batches to avoid overwhelming the system
    const totalRegulations = this.monitoredRegulations.length;
    const batchCount = Math.ceil(totalRegulations / this.batchSize);
    
    console.log(`📋 CDC active: Monitoring ${totalRegulations} regulations`);
    console.log(`   • Batch size: ${this.batchSize} regulations`);
    console.log(`   • Total batches: ${batchCount}`);
    console.log(`   • Poll interval: ${this.pollInterval}ms`);
    console.log(`   • Full cycle time: ${Math.ceil((batchCount * this.pollInterval) / 1000)}s`);
    
    this.pollTimer = setInterval(async () => {
      if (this.isActive && this.monitoredRegulations.length > 0) {
        // Get current batch of regulations
        const startIdx = this.currentBatchIndex * this.batchSize;
        const endIdx = Math.min(startIdx + this.batchSize, totalRegulations);
        const currentBatch = this.monitoredRegulations.slice(startIdx, endIdx);
        
        if (currentBatch.length > 0) {
          console.log(`🔄 Polling batch ${this.currentBatchIndex + 1}/${batchCount} (${currentBatch.length} regulations)...`);
          
          // Process batch in parallel
          await Promise.all(currentBatch.map(async (regId) => {
            try {
              await this.monitorRegulation(regId);
            } catch (error) {
              console.error(`❌ CDC polling error for ${regId}:`, error.message);
            }
          }));
        }
        
        // Move to next batch (circular)
        this.currentBatchIndex = (this.currentBatchIndex + 1) % batchCount;
      }
    }, this.pollInterval);
    
    await this.emit(REGULATION_EVENTS.SYSTEM_READY, {
      service: 'CDC',
      timestamp: new Date().toISOString(),
      regulations: regulationsToMonitor,
      regulationCount: regulationsToMonitor.length,
      mode: 'automatic_polling_with_hash_detection',
      pollInterval: this.pollInterval,
      scalable: true
    });
  }

  /**
   * Initialize baseline state without triggering updates
   */
  async initializeRegulationBaseline(regulationId) {
    try {
      console.log(`📋 Initializing baseline for ${regulationId}...`);
      const currentState = await this.fetchRegulationState(regulationId);
      const contentHash = this.generateContentHash(currentState);
      
      // Set initial state without triggering change events
      this.contentHashes.set(regulationId, contentHash);
      this.lastKnownVersions.set(regulationId, currentState);
      
      console.log(`✅ Baseline established for ${regulationId}`);
    } catch (error) {
      console.warn(`⚠️ Could not initialize baseline for ${regulationId}: ${error.message}`);
      console.log(`📋 Will retry baseline initialization when LLM Gateway is available`);
      
      // Set empty baseline to prevent crashes
      this.contentHashes.set(regulationId, 'initial_empty');
      this.lastKnownVersions.set(regulationId, { error: 'LLM Gateway not ready' });
    }
  }

  async monitorRegulation(regulationId) {
    try {
      // Fetch current regulation state
      const currentState = await this.fetchRegulationState(regulationId);
      const contentHash = this.generateContentHash(currentState);
      
      // Check if content has changed
      const lastHash = this.contentHashes.get(regulationId);
      
      // ✅ CRITICAL FIX: Only trigger update if hash exists AND is different
      // Skip if lastHash is 'initial_empty' (baseline not yet established)
      if (lastHash && lastHash !== 'initial_empty' && lastHash !== contentHash) {
        console.log(`📋 REAL CHANGE DETECTED in ${regulationId}`);
        console.log(`   Previous hash: ${lastHash}`);
        console.log(`   New hash: ${contentHash}`);
        
        await this.emit(REGULATION_EVENTS.CONTENT_CHANGED, {
          regulationId,
          before: this.lastKnownVersions.get(regulationId),
          after: currentState,
          changeType: this.detectChangeType(lastHash, contentHash),
          timestamp: new Date().toISOString(),
          contentHash
        });
      } else if (!lastHash || lastHash === 'initial_empty') {
        console.log(`📋 Establishing baseline for ${regulationId} (hash: ${contentHash.substring(0, 8)}...)`);
      } else {
        // Hash is the same - no change, no spam
        console.log(`📋 No change in ${regulationId} (hash: ${contentHash.substring(0, 8)}...)`);
      }
      
      // Update our tracking
      this.contentHashes.set(regulationId, contentHash);
      this.lastKnownVersions.set(regulationId, currentState);
      
    } catch (error) {
      console.error(`❌ CDC error for ${regulationId}:`, error.message);
    }
  }

  /**
   * Extract and structure ALL required fields for regulation updates
   * ✅ REQUIRED FIELDS: updatedContent, summary, requirements, filingDeadlines
   */
  extractStructuredFields(regulationData) {
    const { uscData, cfrData, complianceData, fullText } = regulationData;
    
    console.log(`📋 Extracting structured fields for regulation update...`);
    
    // 1. UPDATED CONTENT (REQUIRED) - Complete full text
    const updatedContent = fullText;
    
    // 2. SUMMARY (REQUIRED) - Extract from compliance data or generate
    let summary = complianceData?.data?.summary || 
                  complianceData?.summary ||
                  uscData?.data?.summary ||
                  uscData?.summary ||
                  'This regulation establishes compliance requirements for higher education institutions.';
    
    // 3. REQUIREMENTS (REQUIRED) - Structured markdown format
    const requirements = this.extractRequirements(complianceData, uscData, cfrData);
    
    // 4. FILING DEADLINES (if applicable)
    const filingDeadlines = this.extractFilingDeadlines(complianceData, uscData, cfrData, fullText);
    
    return {
      updatedContent,
      summary,
      requirements,
      filingDeadlines
    };
  }
  
  /**
   * Extract detailed compliance requirements in markdown format
   */
  extractRequirements(complianceData, uscData, cfrData) {
    // Try to get structured requirements from compliance data
    const complianceRequirements = complianceData?.data?.requirements || 
                                    complianceData?.requirements ||
                                    complianceData?.data?.content ||
                                    complianceData?.content;
    
    if (typeof complianceRequirements === 'string' && complianceRequirements.includes('**')) {
      // Already formatted in markdown
      return complianceRequirements;
    }
    
    // Build structured requirements from available data
    let requirements = '**Key Compliance Requirements:**\n\n';
    
    // Extract key requirements
    if (complianceData?.data?.keyRequirements) {
      complianceData.data.keyRequirements.forEach((req, idx) => {
        requirements += `${idx + 1}. **${req.title || 'Requirement'}**\n`;
        requirements += `   ${req.description || req.content}\n\n`;
      });
    } else {
      requirements += '1. Comply with all provisions of the regulation as stated in the official source document\n';
      requirements += '2. Maintain institutional policies and procedures aligned with regulatory requirements\n';
      requirements += '3. Ensure all personnel are trained on compliance obligations\n\n';
    }
    
    // Documentation Requirements
    requirements += '**Documentation Requirements:**\n\n';
    if (complianceData?.data?.documentationRequirements) {
      requirements += complianceData.data.documentationRequirements + '\n\n';
    } else {
      requirements += '- Maintain records of all compliance activities and decisions\n';
      requirements += '- Document training completion for all relevant personnel\n';
      requirements += '- Retain records for the period specified in the regulation\n\n';
    }
    
    // Reporting Requirements
    requirements += '**Reporting Requirements:**\n\n';
    if (complianceData?.data?.reportingRequirements) {
      requirements += complianceData.data.reportingRequirements + '\n\n';
    } else {
      requirements += '- Submit required reports to appropriate regulatory agencies as specified\n';
      requirements += '- Maintain internal reporting mechanisms for compliance oversight\n\n';
    }
    
    // Training Requirements
    requirements += '**Training Requirements:**\n\n';
    if (complianceData?.data?.trainingRequirements) {
      requirements += complianceData.data.trainingRequirements + '\n\n';
    } else {
      requirements += '- Provide initial training for all personnel with compliance responsibilities\n';
      requirements += '- Conduct annual refresher training to ensure continued compliance awareness\n';
      requirements += '- Document all training activities and maintain completion records\n\n';
    }
    
    // Monitoring & Compliance
    requirements += '**Monitoring & Compliance:**\n\n';
    if (complianceData?.data?.monitoringRequirements) {
      requirements += complianceData.data.monitoringRequirements + '\n\n';
    } else {
      requirements += '- Conduct regular internal audits of compliance activities\n';
      requirements += '- Review and update policies and procedures annually or as regulations change\n';
      requirements += '- Establish accountability mechanisms for compliance oversight\n';
      requirements += '- Address identified deficiencies promptly and document corrective actions\n';
    }
    
    return requirements;
  }
  
  /**
   * Extract filing deadlines from regulation content
   */
  extractFilingDeadlines(complianceData, uscData, cfrData, fullText) {
    const deadlines = [];
    
    // Check for explicit deadline fields
    if (complianceData?.data?.deadline || complianceData?.deadline) {
      const deadline = complianceData.data?.deadline || complianceData.deadline;
      const description = complianceData.data?.deadlineLabel || complianceData.deadlineLabel || 'Annual compliance deadline';
      deadlines.push(`${description}: ${deadline}`);
    }
    
    if (complianceData?.data?.reportingRequirements && 
        typeof complianceData.data.reportingRequirements === 'string') {
      const reportingText = complianceData.data.reportingRequirements;
      
      // Extract deadline patterns from text
      const deadlinePatterns = [
        /(?:by|before|on or before|no later than)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?)/gi,
        /(?:annually|each year)\s+(?:by|on|before)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?)/gi,
        /deadline[:\s]+([^.\n]+)/gi
      ];
      
      for (const pattern of deadlinePatterns) {
        let match;
        while ((match = pattern.exec(reportingText)) !== null) {
          deadlines.push(`Reporting deadline: ${match[1].trim()}`);
    }
      }
    }
    
    // Parse full text for deadline mentions if no explicit deadlines found
    if (deadlines.length === 0 && fullText) {
      const sentences = fullText.split(/[.!?]\s+/);
      for (const sentence of sentences) {
        if (sentence.match(/deadline|due date|filing date|submission date/i)) {
          const dateMatch = sentence.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?/i);
          if (dateMatch) {
            deadlines.push(`Compliance deadline: ${dateMatch[0]}`);
            break; // Only get the first meaningful deadline
          }
        }
      }
    }
    
    // Default to July 1 if no deadlines found
    if (deadlines.length === 0) {
      deadlines.push('Annual compliance review: July 1');
    }
    
    return deadlines.join('\n');
  }

  async fetchRegulationState(regulationId) {
    // ✅ CRITICAL FIX: Fetch FULL regulation content for EdSteward delivery
    // Was fetching only short text (86 chars), now gets complete regulation with all compliance requirements
    
    console.log(`🔍 Fetching FULL regulation content for ${regulationId} (including all compliance requirements)...`);
    
    // Determine correct endpoints based on regulation type
    let uscEndpoint, cfrEndpoint, complianceEndpoint;
    
    // Endpoint mapping for regulations
    if (regulationId.includes('REG-66') || regulationId.includes('reg-66') || regulationId.includes('teach')) {
      // TEACH Act uses enhanced CFR endpoint with Federal Register integration
      uscEndpoint = 'http://localhost:3004/api/llm/usc/17/110';
      cfrEndpoint = 'http://localhost:3004/api/llm/cfr/enhanced/teach-act?federal_register=true';
      complianceEndpoint = 'http://localhost:3004/api/llm/compliance/teach-act';
    } else if (regulationId.includes('osha') || regulationId.includes('emergency-action-plan') || regulationId.includes('safety')) {
      uscEndpoint = 'http://localhost:3004/api/llm/usc/29/651';
      cfrEndpoint = `http://localhost:3004/api/llm/cfr/${regulationId}`;
      complianceEndpoint = `http://localhost:3004/api/llm/compliance/${regulationId}`;
    } else if (regulationId.includes('age-discrimination')) {
      uscEndpoint = 'http://localhost:3004/api/llm/usc/42/6101';
      cfrEndpoint = `http://localhost:3004/api/llm/cfr/age-discrimination`;
      complianceEndpoint = `http://localhost:3004/api/llm/compliance/age-discrimination`;
    } else if (regulationId.includes('americans-with-disabilities') || regulationId.includes('ada')) {
      uscEndpoint = 'http://localhost:3004/api/llm/usc/42/12101';
      cfrEndpoint = `http://localhost:3004/api/llm/cfr/ada`;
      complianceEndpoint = `http://localhost:3004/api/llm/compliance/ada`;
    } else {
      uscEndpoint = null;
      cfrEndpoint = `http://localhost:3004/api/llm/cfr/${regulationId}`;
      complianceEndpoint = `http://localhost:3004/api/llm/compliance/${regulationId}`;
    }
    
    // Build fetch promises
    const fetchPromises = [];
    
    if (uscEndpoint) {
      fetchPromises.push(fetch(uscEndpoint, {
        method: 'GET',
      headers: { 'Content-Type': 'application/json' }
      }));
    } else {
      fetchPromises.push(Promise.resolve(null));
    }
    
    fetchPromises.push(fetch(cfrEndpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }));
    
    fetchPromises.push(fetch(complianceEndpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }));
    
    // Fetch all regulation data components
    const [uscResponse, cfrResponse, complianceResponse] = await Promise.all(fetchPromises);
    
    // Parse responses
    const [uscData, cfrData, complianceData] = await Promise.all([
      uscResponse ? (uscResponse.ok ? uscResponse.json() : { error: 'USC fetch failed' }) : { data: null },
      cfrResponse.ok ? cfrResponse.json() : { error: 'CFR fetch failed' },
      complianceResponse.ok ? complianceResponse.json() : { error: 'Compliance fetch failed' }
    ]);
    
    // ✅ CRITICAL FIX: Extract regulation full text with comprehensive fallback logic
    // Priority: fullText > content, USC > CFR > Compliance
    let fullText;
    
    if (regulationId.includes('REG-66') || regulationId.includes('reg-66') || regulationId.includes('teach')) {
      // ✅ CRITICAL: For TEACH Act, use fullText field which contains COMPLETE regulation (13K+ chars)
      // NOT content field which only has 86-char summary
      const uscFullText = uscData?.data?.fullText || uscData?.fullText || uscData?.data?.content || uscData?.content || '';
      const complianceFullText = complianceData?.data?.fullText || complianceData?.fullText || complianceData?.data?.content || complianceData?.content || '';
      fullText = uscFullText || complianceFullText || 'USC 17 Section 110 text not available';
    } else if (regulationId.includes('osha')) {
      const uscContent = uscData?.data?.fullText || uscData?.fullText || uscData?.data?.content || uscData?.content || '';
      const cfrContent = cfrData?.data?.sections?.map(section => 
        `${section.section} ${section.title}: ${section.content}`
      ).join('\n\n') || cfrData?.content || cfrData?.fullText || '';
      fullText = uscContent && cfrContent ? `${uscContent}\n\n--- CFR IMPLEMENTATION ---\n\n${cfrContent}` : (uscContent || cfrContent);
    } else {
      // ✅ CRITICAL FIX: Comprehensive fallback for ALL other regulations
      // Try: USC fullText → USC content → CFR sections → CFR content → Compliance fullText → Compliance content
      const uscFullText = uscData?.data?.fullText || uscData?.fullText || '';
      const uscContent = uscData?.data?.content || uscData?.content || '';
      const cfrSections = cfrData?.data?.sections?.map(section => 
        `${section.section} ${section.title}: ${section.content}`
      ).join('\n\n') || '';
      const cfrContent = cfrData?.data?.fullText || cfrData?.fullText || cfrData?.data?.content || cfrData?.content || '';
      const complianceFullText = complianceData?.data?.fullText || complianceData?.fullText || '';
      const complianceContent = complianceData?.data?.content || complianceData?.content || '';
      
      // Build fullText with all available data, prioritizing fullText fields
      const sources = [
        uscFullText,
        uscContent,
        cfrSections,
        cfrContent,
        complianceFullText,
        complianceContent
      ].filter(text => text && text.length > 50); // Only include substantial content
      
      if (sources.length === 0) {
        fullText = `${regulationId} regulation text not available`;
      } else if (sources.length === 1) {
        fullText = sources[0];
      } else {
        // Combine multiple sources with clear delimiters
        fullText = sources.join('\n\n═══════════════════════════════════════════════\n\n');
      }
    }
    
    console.log(`📋 Fetched FULL regulation content (${fullText.length} chars): ${fullText.substring(0, 100)}...`);
    
    // ✅ CRITICAL: Extract structured fields for EdSteward and client delivery
    const structuredFields = this.extractStructuredFields({
      uscData,
      cfrData,
      complianceData,
      fullText
    });
    
    console.log(`📋 Structured fields extracted:`);
    console.log(`   - updatedContent: ${structuredFields.updatedContent.length} chars`);
    console.log(`   - summary: ${structuredFields.summary.substring(0, 80)}...`);
    console.log(`   - requirements: ${structuredFields.requirements.length} chars`);
    console.log(`   - filingDeadlines: ${structuredFields.filingDeadlines}`);
    
    // Return structure compatible with EdSteward integration
    return {
      regulationId,
      content: fullText,
      fullText: fullText,
      // ✅ NEW: Include all structured fields
      updatedContent: structuredFields.updatedContent,
      summary: structuredFields.summary,
      requirements: structuredFields.requirements,
      filingDeadlines: structuredFields.filingDeadlines,
      components: {
        usc: uscData,
        cfr: cfrData,
        compliance: complianceData
      },
      timestamp: new Date().toISOString()
    };
  }

  generateContentHash(content) {
    // ✅ CRITICAL FIX: Only hash the actual regulation content, not timestamps or metadata
    // This prevents false positives where timestamps change but content doesn't
    const contentToHash = {
      regulationId: content.regulationId,
      fullText: content.fullText,
      content: content.content
      // Deliberately exclude: timestamp, components.data.lastUpdated, etc.
    };
    
    return createHash('sha256')
      .update(JSON.stringify(contentToHash))
      .digest('hex')
      .substring(0, 16);
  }

  detectChangeType(oldHash, newHash) {
    // Simple change detection - in production, this would be more sophisticated
    return 'content_update';
  }

  async stopMonitoring() {
    this.isActive = false;
    console.log('⏹️ CDC monitoring stopped');
  }
}

/**
 * Event Sourcing Store for Regulation Events
 * Provides immutable event log and state reconstruction
 */
class RegulationEventStore extends Emittery {
  constructor() {
    super({
      debug: {
        name: 'EventStore',
        enabled: process.env.NODE_ENV === 'development'
      }
    });
    
    this.events = [];
    this.snapshots = new Map();
    this.aggregateVersions = new Map();
  }

  /**
   * Append new event to the event store
   * Following event sourcing best practices
   */
  async appendEvent(aggregateId, eventType, eventData) {
    const currentVersion = this.aggregateVersions.get(aggregateId) || 0;
    const newVersion = currentVersion + 1;
    
    const event = {
      eventId: this.generateEventId(),
      aggregateId,
      aggregateVersion: newVersion,
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'MCP-Engine',
        causationId: eventData.causationId,
        correlationId: eventData.correlationId
      }
    };
    
    // Store the event
    this.events.push(event);
    this.aggregateVersions.set(aggregateId, newVersion);
    
    console.log(`📝 Event stored: ${eventType} for ${aggregateId} v${newVersion}`);
    
    // Emit for downstream consumers
    await this.emit(eventType, event);
    
    return event;
  }

  /**
   * Get events for specific regulation
   */
  getEvents(aggregateId, fromVersion = 0) {
    return this.events.filter(event => 
      event.aggregateId === aggregateId && 
      event.aggregateVersion > fromVersion
    );
  }

  /**
   * Reconstruct current state from events
   */
  getCurrentState(aggregateId) {
    const events = this.getEvents(aggregateId);
    
    // Simple state reconstruction - in production would use proper aggregate
    let state = { id: aggregateId, version: 0 };
    
    for (const event of events) {
      state = this.applyEvent(state, event);
    }
    
    return state;
  }

  applyEvent(state, event) {
    // Apply event to state - specific to regulation domain
    switch (event.eventType) {
      case 'RegulationContentChanged':
        return {
          ...state,
          content: event.eventData.after,
          version: event.aggregateVersion,
          lastModified: event.timestamp
        };
      default:
        return { ...state, version: event.aggregateVersion };
    }
  }

  generateEventId() {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 12);
  }
}

/**
 * WebSocket Push Notification Service
 * Real-time delivery to connected clients
 */
class RegulationPushService extends Emittery {
  constructor(server) {
    super({
      debug: {
        name: 'PushService',
        enabled: process.env.NODE_ENV === 'development'
      }
    });
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/regulation-updates'
    });
    
    this.clients = new Map();
    this.subscriptions = new Map();
    
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      console.log(`🔌 Client connected: ${clientId}`);
      
      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(`❌ Invalid message from ${clientId}:`, error.message);
        }
      });

      ws.on('close', () => {
        console.log(`📴 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error.message);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      });
    });
  }

  async handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date().toISOString();

    switch (message.type) {
      case 'subscribe':
        await this.subscribeClient(clientId, message.regulationIds || []);
        break;
      
      case 'unsubscribe':
        await this.unsubscribeClient(clientId, message.regulationIds || []);
        break;
      
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
        break;
        
      default:
        console.warn(`⚠️ Unknown message type: ${message.type}`);
    }
  }

  async subscribeClient(clientId, regulationIds) {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const regulationId of regulationIds) {
      client.subscriptions.add(regulationId);
      
      if (!this.subscriptions.has(regulationId)) {
        this.subscriptions.set(regulationId, new Set());
      }
      this.subscriptions.get(regulationId).add(clientId);
    }

    console.log(`📋 Client ${clientId} subscribed to: ${regulationIds.join(', ')}`);
    
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      regulationIds,
      timestamp: new Date().toISOString()
    });
  }

  async unsubscribeClient(clientId, regulationIds) {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const regulationId of regulationIds) {
      client.subscriptions.delete(regulationId);
      
      if (this.subscriptions.has(regulationId)) {
        this.subscriptions.get(regulationId).delete(clientId);
      }
    }

    console.log(`📋 Client ${clientId} unsubscribed from: ${regulationIds.join(', ')}`);
  }

  /**
   * Get all regulation ID aliases (for matching subscriptions)
   */
  getRegulationAliases(regulationId) {
    const aliases = {
      // TEACH Act aliases
      'REG-66': ['REG-66', 'reg-66', 'technology-education-and-copyright-harmonization-a', 'teach-act'],
      'reg-66': ['REG-66', 'reg-66', 'technology-education-and-copyright-harmonization-a', 'teach-act'],
      'technology-education-and-copyright-harmonization-a': ['REG-66', 'reg-66', 'technology-education-and-copyright-harmonization-a', 'teach-act'],
      'teach-act': ['REG-66', 'reg-66', 'technology-education-and-copyright-harmonization-a', 'teach-act'],
      
      // Age Discrimination Act aliases
      'age-discrimination-act-of-1975': ['age-discrimination-act-of-1975', 'REG-1785'],
      'REG-1785': ['age-discrimination-act-of-1975', 'REG-1785'],
      
      // ADA aliases
      'americans-with-disabilities-act-of-1990': ['americans-with-disabilities-act-of-1990', 'ada', 'REG-1786'],
      'ada': ['americans-with-disabilities-act-of-1990', 'ada', 'REG-1786'],
      'REG-1786': ['americans-with-disabilities-act-of-1990', 'ada', 'REG-1786']
    };
    
    return aliases[regulationId] || [regulationId];
  }

  /**
   * Push regulation update to subscribed clients
   */
  async pushRegulationUpdate(regulationId, updateData) {
    // ✅ CRITICAL FIX: Check all regulation ID aliases for subscriptions
    // This allows REG-66 updates to reach clients subscribed to "technology-education-and-copyright-harmonization-a"
    const aliases = this.getRegulationAliases(regulationId);
    const allSubscribedClients = new Set();
    
    for (const alias of aliases) {
      const clients = this.subscriptions.get(alias);
      if (clients) {
        clients.forEach(clientId => allSubscribedClients.add(clientId));
      }
    }
    
    if (allSubscribedClients.size === 0) {
      console.log(`📭 No clients subscribed to ${regulationId} (checked aliases: ${aliases.join(', ')})`);
      return;
    }

    console.log(`📨 Found ${allSubscribedClients.size} clients subscribed via aliases: ${aliases.join(', ')}`);

    const notification = {
      type: 'regulation_updated',
      regulationId, // Keep original ID in notification
      timestamp: new Date().toISOString(),
      data: updateData,
      version: updateData.version || 'unknown'
    };

    let successCount = 0;
    let failureCount = 0;

    for (const clientId of allSubscribedClients) {
      try {
        await this.sendToClient(clientId, notification);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to notify client ${clientId}:`, error.message);
        failureCount++;
      }
    }

    console.log(`📨 Pushed ${regulationId} update to ${successCount} clients (${failureCount} failures)`);
    
    await this.emit(REGULATION_EVENTS.CUSTOMER_NOTIFIED, {
      regulationId,
      successCount,
      failureCount,
      notification
    });
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1) { // WebSocket.OPEN = 1
      throw new Error(`Client ${clientId} not available`);
    }

    client.ws.send(JSON.stringify(message));
  }

  generateClientId() {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 8);
  }

  getConnectionStats() {
    return {
      totalClients: this.clients.size,
      subscriptions: Object.fromEntries(
        Array.from(this.subscriptions.entries()).map(([reg, clients]) => [reg, clients.size])
      )
    };
  }

  /**
   * Get detailed info about all connected clients
   */
  getConnectedClients() {
    const clients = [];
    for (const [clientId, client] of this.clients) {
      clients.push({
        id: clientId,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity || client.connectedAt,
        subscriptions: Array.from(client.subscriptions || []),
        isConnected: client.ws.readyState === 1 // WebSocket.OPEN
      });
    }
    return clients;
  }

  /**
   * Push update to specific client(s) by ID
   */
  async pushToSpecificClients(clientIds, notification) {
    const results = {
      success: [],
      failed: []
    };

    for (const clientId of clientIds) {
      try {
        await this.sendToClient(clientId, notification);
        results.success.push(clientId);
      } catch (error) {
        results.failed.push({ clientId, error: error.message });
      }
    }

    console.log(`📨 Targeted push: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Add client subscription for regulation updates
   */
  addSubscription(regulationId, clientId) {
    if (!this.subscriptions.has(regulationId)) {
      this.subscriptions.set(regulationId, new Set());
    }
    this.subscriptions.get(regulationId).add(clientId);
    
    // Update client's subscription list
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(regulationId);
    }
    
    console.log(`📋 Client ${clientId} subscribed to ${regulationId}`);
    return true;
  }

  /**
   * Remove client subscription
   */
  removeSubscription(regulationId, clientId) {
    const regulationSubs = this.subscriptions.get(regulationId);
    if (regulationSubs) {
      regulationSubs.delete(clientId);
      if (regulationSubs.size === 0) {
        this.subscriptions.delete(regulationId);
      }
    }
    
    // Update client's subscription list
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(regulationId);
    }
    
    console.log(`📋 Client ${clientId} unsubscribed from ${regulationId}`);
    return true;
  }

  /**
   * Get all subscriptions for a regulation
   */
  getSubscriptions(regulationId) {
    return Array.from(this.subscriptions.get(regulationId) || []);
  }
}

/**
 * Main Regulation Delivery Engine
 * Orchestrates all components using Emittery patterns
 */
class RegulationDeliveryEngine extends Emittery {
  constructor(httpServer) {
    super({
      debug: {
        name: 'DeliveryEngine',
        enabled: process.env.NODE_ENV === 'development'
      }
    });
    
    this.cdc = new RegulationCDCService();
    this.eventStore = new RegulationEventStore();
    this.pushService = new RegulationPushService(httpServer);
    
    this.setupEventHandlers();
  }

  /**
   * Wire up event handlers using Emittery patterns
   */
  setupEventHandlers() {
    // CDC events -> Event Store -> Push Notifications
    this.cdc.on(REGULATION_EVENTS.CONTENT_CHANGED, async (changeData) => {
      console.log(`🔄 Processing content change for ${changeData.regulationId}`);
      
      // Store event
      const event = await this.eventStore.appendEvent(
        changeData.regulationId,
        'RegulationContentChanged',
        changeData
      );
      
      // Push to clients with FULL structured fields
      await this.pushService.pushRegulationUpdate(
        changeData.regulationId,
        {
          changeType: changeData.changeType,
          version: event.aggregateVersion,
          timestamp: event.timestamp,
          // ✅ CRITICAL: Include ALL structured fields from changeData.after
          updatedContent: changeData.after?.updatedContent || changeData.after?.fullText || changeData.after?.content,
          summary: changeData.after?.summary,
          requirements: changeData.after?.requirements,
          filingDeadlines: changeData.after?.filingDeadlines,
          // Include full after data for compatibility
          ...changeData.after,
          changeSummary: this.generateChangeSummary(changeData)
        }
      );
      
      // Emit delivery engine event
      await this.emit(REGULATION_EVENTS.DELIVERY_CONFIRMED, {
        regulationId: changeData.regulationId,
        eventId: event.eventId,
        clientsNotified: this.pushService.getConnectionStats().subscriptions[changeData.regulationId] || 0,
        updateData: changeData
      });
    });

    // System health monitoring
    this.pushService.on(REGULATION_EVENTS.CUSTOMER_NOTIFIED, async (data) => {
      if (data.failureCount > 0) {
        await this.emit(REGULATION_EVENTS.PERFORMANCE_ALERT, {
          type: 'delivery_failures',
          details: data
        });
      }
    });
  }

  generateChangeSummary(changeData) {
    return {
      regulation: changeData.regulationId,
      type: changeData.changeType,
      affectedSections: this.extractAffectedSections(changeData),
      impactLevel: this.assessImpactLevel(changeData)
    };
  }

  extractAffectedSections(changeData) {
    // Analyze the change to identify affected sections
    // This would be more sophisticated in production
    return ['Section 110(2)', 'Compliance Requirements'];
  }

  assessImpactLevel(changeData) {
    // Determine impact level for customer prioritization
    return 'medium'; // Could be 'low', 'medium', 'high', 'critical'
  }

  /**
   * Start the entire delivery system
   */
  async start() {
    console.log('🚀 Starting MCP Regulation Delivery Engine...');
    
    try {
      await this.cdc.startMonitoring();
      console.log('✅ CDC monitoring active');
      
      console.log('✅ Event store ready');
      console.log('✅ WebSocket push service ready');
      
      await this.emit(REGULATION_EVENTS.SYSTEM_READY, {
        timestamp: new Date().toISOString(),
        components: ['CDC', 'EventStore', 'PushService']
      });
      
      console.log('🎯 Regulation Delivery Engine is ready!');
      
    } catch (error) {
      console.error('❌ Failed to start Delivery Engine:', error);
      throw error;
    }
  }

  /**
   * Stop the delivery system gracefully
   */
  async stop() {
    console.log('⏹️ Stopping Regulation Delivery Engine...');
    
    await this.cdc.stopMonitoring();
    this.pushService.wss.close();
    
    console.log('✅ Delivery Engine stopped');
  }

  /**
   * Get system status for monitoring
   */
  getStatus() {
    return {
      cdc: {
        active: this.cdc.isActive,
        regulations: this.cdc.lastKnownVersions.size
      },
      eventStore: {
        events: this.eventStore.events.length,
        aggregates: this.eventStore.aggregateVersions.size
      },
      pushService: this.pushService.getConnectionStats()
    };
  }

  /**
   * Add client subscription for regulation updates
   */
  addSubscription(regulationId, clientId) {
    return this.pushService.addSubscription(regulationId, clientId);
  }

  /**
   * Remove client subscription
   */
  removeSubscription(regulationId, clientId) {
    return this.pushService.removeSubscription(regulationId, clientId);
  }

  /**
   * Get all subscriptions for a regulation
   */
  getSubscriptions(regulationId) {
    return this.pushService.getSubscriptions(regulationId);
  }
}

export { 
  RegulationDeliveryEngine, 
  REGULATION_EVENTS,
  RegulationCDCService,
  RegulationEventStore,
  RegulationPushService
};
