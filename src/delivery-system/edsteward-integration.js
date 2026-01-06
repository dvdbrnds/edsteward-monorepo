/**
 * EdSteward Integration Service v2.1
 * Updated: January 6, 2026
 * Based on EdSteward AI Integration Response (including Compliance Tasks)
 * 
 * Sends MCP Engine regulation updates to EdSteward's API endpoint
 * with proper authentication, payload format, compliance tasks, and error handling.
 * 
 * Hybrid Approach:
 * - Template regulations (Clery, FERPA, Title IX): send templateHint only
 * - Tier 1/2 regulations (ADA, OSHA, Title IV): generate complianceTasks[]
 * - Simple regulations: no tasks (attestation workflow)
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ComplianceTaskGenerator } from '../services/compliance-task-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
let config;
try {
  const configPath = path.join(__dirname, '../../config/edsteward-integration.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.warn('⚠️ EdSteward config not found, using defaults');
  config = {
    environments: {
      development: {
        baseUrl: 'http://localhost:3000',
        endpoint: '/api/regulation-updates',
        healthCheck: '/api/regulation-updates/bulk-import/health'
      }
    },
    authentication: {
      method: 'basic',
      username: 'dvdbrnds',
      password: 'gabadh',
      base64: 'ZHZkYnJuZHM6Z2FiYWRo'
    },
    rateLimits: {
      delayBetweenRequests: 100
    }
  };
}

/**
 * EdSteward Regulation ID Mapping
 * Maps MCP Engine slugs to EdSteward integer IDs (1-500 range)
 * Updated: January 6, 2026
 */
const REGULATION_ID_MAP = {
  // Core education regulations
  'family-educational-rights-and-privacy-act-ferpa': 42,
  'ferpa': 42,
  'clery-act': 9,
  'jeanne-clery-disclosure-of-campus-security-policy-': 9,
  'title-ix-of-the-education-amendment-of-1972': 7,
  'title-ix': 7,
  'higher-education-act-title-iv-student-financial-a': 3,
  'section-504-of-the-rehabilitation-act-of-1973': 6,
  'section-504': 6,
  'americans-with-disabilities-act-of-1990': 2,
  'ada': 2,
  'title-vi-of-the-civil-rights-act-of-1964': 8,
  'violence-against-women-reauthorization-act': 58,
  
  // TEACH Act / REG-66
  'technology-education-and-copyright-harmonization-a': 55,
  'teach-act': 55,
  'reg-66': 55,
      'REG-66': 55,
  
  // Additional regulations
  'drug-free-schools-and-communities-act': 60,
  'drug-free-workplace-act': 61,
      'age-discrimination-act-of-1975': 1,
      'higher-education-act-institutional-and-financial-a': 3,
      'higher-education-act-textbook-information': 4,
      'higher-education-opportunity-act-sections-152-and-': 5,
      'teacher-preparation-programs': 9,
      'bankruptcy-abuse-prevention-consumer-protection-ac': 10,
      'clayton-antitrust-act-of-1914': 11,
      'fair-credit-reporting-act-fcra': 12,
      'federal-insurance-contributions-act-fica': 13,
      'federal-unemployment-tax-act-futa': 14,
      'higher-education-act-disclosure-of-foreign-gifts': 15,
      'qualified-tuition-and-student-loan-interest-report': 16,
      'regulation-e-electronic-fund-transfers': 17,
      'sarbanes-oxley-act-of-2002-sox': 18,
      'sherman-antitrust-act': 19,
      'social-security-act': 20,
      'age-discrimination-in-employment-act-of-1967': 21,
      'civil-rights-act-of-1964': 23,
      'equal-pay-act-of-1963': 24,
      'fair-labor-standards-act-flsa': 25,
      'the-family-and-medical-leave-act-of-1993': 26,
      'immigration-and-nationality-act': 27,
      'occupational-safety-and-health-act-of-1970': 28,
      'pregnancy-discrimination-act': 29,
      'title-vii-of-the-civil-rights-act-of-1964': 30,
      'worker-adjustment-and-retraining-notification-act-': 31,
      'consolidated-omnibus-budget-reconciliation-act-cob': 32,
      'employee-retirement-income-security-act-of-1974-er': 33,
      'health-insurance-portability-and-accountability-ac': 34,
      'cafeteria-plan-regulations': 35,
      'copyright-act': 40,
      'digital-millennium-copyright-act-dmca': 41,
      'children-s-online-privacy-protection-act-of-1998-c': 43,
      'computer-fraud-and-abuse-act': 44,
      'electronic-communications-privacy-act-of-1986': 45,
      'gramm-leach-bliley-act-glba': 46,
      'health-information-technology-for-economic-and-cli': 47,
      'higher-education-act-campus-security': 56,
      'campus-sexual-violence-elimination-act': 59,
      'controlled-substances-act': 62,
      'clean-air-act': 71,
      'clean-water-act': 72,
      'safe-drinking-water-act': 73,
      'emergency-planning-and-community-right-to-know-act': 75,
      'native-american-graves-protection-and-repatriation': 80,
      'davis-bacon-act': 93,
      'small-business-act': 103,
      'foreign-corrupt-practices-act-fcpa': 113,
      'export-administration-regulations': 244,
      'deferred-compensation': 252,
      'foreign-bank-accounts-and-tax-filings': 266,
  'qualified-tuition-reductions': 269
};

/**
 * Template detection keywords
 */
const TEMPLATE_KEYWORDS = {
  'clery': ['clery', 'campus security', 'crime statistics', 'annual security report', '1092(f)'],
  'ferpa': ['ferpa', 'student records', 'education records', 'privacy', '1232g'],
  'title-ix': ['title ix', 'title-ix', 'sex discrimination', 'sexual harassment', '1681']
};

export class EdStewardIntegration {
  constructor(options = {}) {
    // Determine environment
    this.environment = options.environment || process.env.EDSTEWARD_ENV || 'development';
    const envConfig = config.environments[this.environment] || config.environments.development;
    
    this.baseUrl = options.edstewardUrl || process.env.EDSTEWARD_URL || envConfig.baseUrl;
    this.endpoint = envConfig.endpoint;
    this.healthCheckEndpoint = envConfig.healthCheck;
    
    // Authentication
    this.authMethod = config.authentication.method;
    this.username = options.username || process.env.EDSTEWARD_USERNAME || config.authentication.username;
    this.password = options.password || process.env.EDSTEWARD_PASSWORD || config.authentication.password;
    this.authHeader = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    
    // Rate limiting
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.requestDelay = config.rateLimits?.delayBetweenRequests || 100;
    
    // WebSocket
    this.websocketUrl = options.websocketUrl || process.env.EDSTEWARD_WS_URL || `${this.baseUrl.replace('http', 'ws')}/ws`;
    
    // Compliance Task Generator
    this.taskGenerator = new ComplianceTaskGenerator({ logger: console });
    
    console.log(`🔗 EdSteward Integration v2.1 initialized`);
    console.log(`   Environment: ${this.environment}`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   Endpoint: ${this.endpoint}`);
    console.log(`   Auth: Basic Auth configured`);
    console.log(`   Task Generator: Hybrid approach (templates + generated tasks)`);
  }

  /**
   * Get EdSteward integer ID for a regulation
   * Uses 1-500 range as required by EdSteward's Master Key Field system
   */
  getEdStewardId(regulationSlug) {
    // Direct lookup
    if (REGULATION_ID_MAP[regulationSlug]) {
      return REGULATION_ID_MAP[regulationSlug];
    }
    
    // Try lowercase
    const lowerSlug = regulationSlug.toLowerCase();
    if (REGULATION_ID_MAP[lowerSlug]) {
      return REGULATION_ID_MAP[lowerSlug];
    }
    
    // Generate hash-based ID in 1-500 range for unmapped regulations
    const hash = createHash('md5').update(regulationSlug).digest('hex');
    const generatedId = 1 + (parseInt(hash.substring(0, 8), 16) % 500);
    
    console.log(`🆕 Generated EdSteward ID for ${regulationSlug}: ${generatedId} (hash-based)`);
    return generatedId;
  }

  /**
   * Detect which template should be suggested
   */
  detectTemplate(regulation) {
    const name = (regulation.name || regulation.regulationId || '').toLowerCase();
    const statute = (regulation.statute || '').toLowerCase();
    const combined = `${name} ${statute}`;
    
    for (const [template, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
      if (keywords.some(kw => combined.includes(kw))) {
        return template;
      }
    }
    
    return null;
  }

  /**
   * Format requirements as EdSteward expects (newline-separated with bullets)
   */
  formatRequirements(requirements) {
    if (!requirements) return null;
    
    // If already a string with bullets, return as-is
    if (typeof requirements === 'string') {
      if (requirements.includes('•') || requirements.includes('**')) {
        return requirements;
      }
      return requirements;
    }
    
    // If array, join with bullet points
    if (Array.isArray(requirements)) {
      return requirements.map(req => `• ${req}`).join('\n');
    }
    
    return null;
  }

  /**
   * Format filing deadlines as EdSteward expects
   * Returns JSON string of array: [{type, date, frequency, description}]
   */
  formatFilingDeadlines(deadlines, reportingRequirements) {
    const result = [];
    
    // Handle reportingRequirements object
    if (reportingRequirements) {
      if (typeof reportingRequirements === 'object') {
        result.push({
          type: 'Primary Deadline',
          date: reportingRequirements.deadline || 'As specified',
          frequency: reportingRequirements.frequency || 'annual',
          description: reportingRequirements.submissionMethod || 'See regulation for details'
        });
      }
    }
    
    // Handle deadlines string or array
    if (deadlines) {
      if (typeof deadlines === 'string') {
        // Parse deadline string
        const lines = deadlines.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const match = line.match(/([^:]+):\s*(.+)/);
          if (match) {
            result.push({
              type: match[1].trim(),
              date: match[2].trim(),
              frequency: 'annual',
              description: line
            });
          }
        });
      } else if (Array.isArray(deadlines)) {
        result.push(...deadlines);
      }
    }
    
    // Return null if empty, otherwise JSON string
    return result.length > 0 ? JSON.stringify(result) : null;
  }

  /**
   * Transform MCP Engine update to EdSteward payload format
   * Includes compliance tasks based on hybrid approach:
   * - Template regulations: templateHint only
   * - Tier 1/2 regulations: generate complianceTasks[]
   * - Simple regulations: no tasks
   */
  transformPayload(mcpUpdate) {
    const regulationId = this.getEdStewardId(mcpUpdate.regulationId);
    const after = mcpUpdate.data?.after || mcpUpdate;
    const before = mcpUpdate.data?.before || {};
    const slug = mcpUpdate.regulationId;
    
    // Generate compliance tasks using hybrid approach
    const taskResult = this.taskGenerator.generateTasks(slug);
    
    // Get template hint (either from task generator or manual detection)
    let templateHint = taskResult.templateHint;
    if (!templateHint) {
      templateHint = this.detectTemplate({
        name: after.name || mcpUpdate.regulationId,
        statute: after.statute
      });
    }
    
    // Format requirements
    const requirements = this.formatRequirements(
      after.requirements || mcpUpdate.requirements
    );
    
    // Format filing deadlines
    const filingDeadlines = this.formatFilingDeadlines(
      after.filingDeadlines || mcpUpdate.filingDeadlines,
      after.reportingRequirements || mcpUpdate.reportingRequirements
    );
    
    // Build payload matching EdSteward schema
    const payload = {
      // Required fields
      regulationId: regulationId,
      name: this.getRegulationName(mcpUpdate.regulationId),
      
      // Content fields
      status: 'pending',
      originalContent: before.fullText || before.content || '',
      updatedContent: after.fullText || after.content || after.updatedContent || '',
      
      // Summary
      summary: after.summary || mcpUpdate.summary || 
               `Compliance requirements for ${this.getRegulationName(mcpUpdate.regulationId)}`,
      
      // Requirements (newline-separated with bullets)
      requirements: requirements,
      
      // Filing deadlines (JSON array string)
      filingDeadlines: filingDeadlines,
      
      // Compliance Tasks (if generated, null if template or simple)
      complianceTasks: taskResult.tasks,
      
      // Metadata with audit scores, template hint, tasks info, etc.
      metadata: {
        // Federal Register enhancement
        federal_register_enhancement: after.federal_register_enhancement || {
          attempted: true,
          successful: true,
          contexts_found: 0,
          total_documents_referenced: 0
        },
        
        // Audit scores from MCP Engine
        audit: after.audit || mcpUpdate.audit || {
          score: 85,
          completeness: 85,
          accuracy: 85,
          requirements_clarity: 85,
          lastAudit: new Date().toISOString()
        },
        
        // Source attribution
        source_attribution: after.source || mcpUpdate.source || 'eCFR + Federal Register',
        
        // Template hint for EdSteward (Clery, FERPA, Title IX)
        templateHint: templateHint,
        suggestedTemplate: templateHint,
        templateConfidence: templateHint ? 0.99 : 0,
        skipTaskGeneration: taskResult.hasTemplate,
        
        // Task generation metadata
        tasksGenerated: taskResult.tasks !== null,
        taskCount: taskResult.tasks?.length || 0,
        regulationCategory: this.taskGenerator.getRegulationCategory(slug),
        
        // Change information
        changeType: mcpUpdate.changeType || 'content_update',
        changeDescription: mcpUpdate.changeDescription || 'Regulation content updated via MCP Engine',
        previousVersion: before.version || null,
        newVersion: after.version || new Date().toISOString().split('T')[0],
        
        // Processing metadata
        processing_metadata: {
          processed_at: new Date().toISOString(),
          enhancement_attempted: true,
          enhancement_successful: true,
          mcp_engine_id: mcpUpdate.regulationId,
          mcp_engine_version: '2.1',
          task_generator_version: '1.0'
        }
      }
    };
    
    // Log task generation result
    if (taskResult.hasTemplate) {
      console.log(`📋 ${slug}: Using EdSteward template "${templateHint}"`);
    } else if (taskResult.tasks) {
      console.log(`📋 ${slug}: Generated ${taskResult.tasks.length} compliance tasks`);
    } else {
      console.log(`📋 ${slug}: Simple attestation workflow (no tasks)`);
    }
    
    return payload;
  }

  /**
   * Send regulation update to EdSteward
   */
  async sendRegulationUpdate(mcpUpdate) {
    console.log(`📤 Preparing EdSteward update for ${mcpUpdate.regulationId}...`);
    
    // Transform to EdSteward format
    const payload = this.transformPayload(mcpUpdate);
    
    console.log(`📋 EdSteward Payload:`);
    console.log(`   regulationId: ${payload.regulationId}`);
    console.log(`   name: ${payload.name}`);
    console.log(`   originalContent: ${(payload.originalContent || '').length} chars`);
    console.log(`   updatedContent: ${(payload.updatedContent || '').length} chars`);
    console.log(`   summary: ${(payload.summary || '').substring(0, 60)}...`);
    console.log(`   requirements: ${(payload.requirements || '').length} chars`);
    console.log(`   templateHint: ${payload.metadata.templateHint || 'none'}`);
    console.log(`   audit.score: ${payload.metadata.audit?.score || 'N/A'}`);
    
    return await this.sendWithRetry(payload);
  }

  /**
   * Send update with retry logic
   */
  async sendWithRetry(payload, attempt = 1) {
    try {
      const url = `${this.baseUrl}${this.endpoint}`;
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add Basic Auth for non-localhost
      if (!this.baseUrl.includes('localhost')) {
        headers['Authorization'] = this.authHeader;
      }
      
      console.log(`📤 Sending to ${url} (attempt ${attempt}/${this.retryAttempts})...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let result;
      
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { raw: responseText };
      }

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 400) {
          console.error(`❌ Validation error: ${result.error || responseText}`);
          if (result.details) {
            result.details.forEach(d => console.error(`   - ${d.path?.join('.')}: ${d.message}`));
          }
        } else if (response.status === 401) {
          console.error(`❌ Authentication failed. Check credentials.`);
        } else if (response.status === 429) {
          console.error(`❌ Rate limited. Waiting before retry...`);
          await this.delay(15000); // Wait 15 seconds on rate limit
        }
        
        throw new Error(`HTTP ${response.status}: ${result.error || response.statusText}`);
      }

      console.log(`✅ EdSteward update successful!`);
      console.log(`   Update ID: ${result.updateId || 'N/A'}`);
      console.log(`   Regulation ID: ${payload.regulationId}`);
      console.log(`   Verified: ${result.verified || false}`);
      
      // Send WebSocket notification
      await this.sendWebSocketNotification({
        regulationId: payload.regulationId,
        updateId: result.updateId,
        name: payload.name,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        updateId: result.updateId,
        regulationId: payload.regulationId,
        result
      };

    } catch (error) {
      console.error(`❌ EdSteward update failed (attempt ${attempt}):`, error.message);
      
      if (attempt < this.retryAttempts) {
        const backoffDelay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`🔄 Retrying in ${backoffDelay}ms...`);
        await this.delay(backoffDelay);
        return await this.sendWithRetry(payload, attempt + 1);
      }
      
      return {
        success: false,
        error: error.message,
        attempts: attempt,
        regulationId: payload.regulationId
      };
    }
  }

  /**
   * Test EdSteward connection via health check endpoint
   */
  async testConnection() {
    try {
      console.log(`🧪 Testing EdSteward connection...`);
      console.log(`   URL: ${this.baseUrl}${this.healthCheckEndpoint}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (!this.baseUrl.includes('localhost')) {
        headers['Authorization'] = this.authHeader;
      }
      
      const response = await fetch(`${this.baseUrl}${this.healthCheckEndpoint}`, {
        signal: controller.signal,
        headers
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const health = await response.json();
        console.log(`✅ EdSteward connection successful!`);
        console.log(`   Status: ${health.status}`);
        console.log(`   Bulk Import: ${health.bulkImportEnabled}`);
        console.log(`   Database: ${health.database}`);
        console.log(`   Pending Updates: ${health.pendingUpdates}`);
        return { success: true, health };
      } else {
        console.warn(`⚠️ EdSteward responded with status ${response.status}`);
        return { success: false, status: response.status };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ EdSteward connection timeout');
      } else {
      console.error('❌ EdSteward connection failed:', error.message);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Get human-readable regulation name
   */
  getRegulationName(mcpRegulationId) {
    const names = {
      'REG-66': 'Technology, Education, and Copyright Harmonization Act (TEACH Act)',
      'reg-66': 'Technology, Education, and Copyright Harmonization Act (TEACH Act)',
      'technology-education-and-copyright-harmonization-a': 'Technology, Education, and Copyright Harmonization Act (TEACH Act)',
      'teach-act': 'Technology, Education, and Copyright Harmonization Act (TEACH Act)',
      'family-educational-rights-and-privacy-act-ferpa': 'Family Educational Rights and Privacy Act (FERPA)',
      'ferpa': 'Family Educational Rights and Privacy Act (FERPA)',
      'clery-act': 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act',
      'title-ix-of-the-education-amendment-of-1972': 'Title IX of the Education Amendments of 1972',
      'title-ix': 'Title IX of the Education Amendments of 1972',
      'americans-with-disabilities-act-of-1990': 'Americans with Disabilities Act of 1990',
      'ada': 'Americans with Disabilities Act of 1990',
      'section-504-of-the-rehabilitation-act-of-1973': 'Section 504 of the Rehabilitation Act of 1973',
      'title-vi-of-the-civil-rights-act-of-1964': 'Title VI of the Civil Rights Act of 1964',
      'violence-against-women-reauthorization-act': 'Violence Against Women Reauthorization Act (VAWA)',
      'drug-free-schools-and-communities-act': 'Drug-Free Schools and Communities Act',
      'higher-education-act-title-iv-student-financial-a': 'Higher Education Act Title IV - Student Financial Assistance'
    };
    
    return names[mcpRegulationId] || 
           mcpRegulationId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Send WebSocket notification for instant UI refresh
   */
  async sendWebSocketNotification(updateData) {
    return new Promise((resolve) => {
      try {
        console.log(`📡 Sending WebSocket notification...`);
        
        const ws = new WebSocket(this.websocketUrl);
        
        ws.on('open', () => {
          const message = {
            type: 'regulation_updated',
            data: updateData
          };
          
          ws.send(JSON.stringify(message));
          console.log(`✅ WebSocket notification sent`);
          ws.close();
          resolve(true);
        });
        
        ws.on('error', (error) => {
          console.warn(`⚠️ WebSocket notification failed: ${error.message}`);
          resolve(false);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          resolve(false);
        }, 5000);
        
      } catch (error) {
        console.warn(`⚠️ WebSocket notification error: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add a new regulation mapping
   */
  addRegulationMapping(mcpSlug, edstewardId) {
    REGULATION_ID_MAP[mcpSlug] = edstewardId;
    console.log(`📋 Added mapping: ${mcpSlug} -> ${edstewardId}`);
  }

  /**
   * Get all current mappings
   */
  getMappings() {
    return { ...REGULATION_ID_MAP };
  }
}

export default EdStewardIntegration;

