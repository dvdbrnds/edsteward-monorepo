/**
 * Dynamic Console Generator
 * Generates regulation-specific console pages from template
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConsoleGenerator {
  constructor() {
    // Use the REG-66 template as the base and customize it for each regulation
    this.templatePath = path.join(__dirname, '../client/public/reg-66-advanced-console.html');
    this.template = null;
    this.loadTemplate();
  }

  loadTemplate() {
    try {
      this.template = fs.readFileSync(this.templatePath, 'utf8');
    } catch (error) {
      console.error('Failed to load console template:', error);
      throw new Error('Console template not found');
    }
  }

  /**
   * Get proper regulation ID based on regulation data
   * Uses the regulation slug instead of timestamp-based IDs
   */
  getProperRegulationId(regulation) {
    // First try to use the regulation slug (from URL path)
    const slug = this.getRegulationSlug(regulation);
    if (slug && slug !== 'unknown-regulation') {
      return slug;
    }
    
    // Fallback to Item ID if available
    if (regulation['Item ID']) {
      return `REG-${regulation['Item ID']}`;
    }
    
    // Last resort: use regulation.id or generate from statute name
    if (regulation.id) {
      return regulation.id;
    }
    
    // Generate from statute name as last resort
    const statuteName = regulation['Statute Name'] || 'Unknown Regulation';
    return statuteName.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * Generate a regulation-specific console page
   * @param {Object} regulation - Regulation data from CSV
   * @returns {string} - Generated HTML content
   */
  generateConsole(regulation) {
    if (!this.template) {
      throw new Error('Console template not loaded');
    }

    // Extract and clean regulation data with comprehensive CSV field mapping
    const regulationData = {
      REGULATION_ID: this.getProperRegulationId(regulation),
      REGULATION_NAME: this.cleanText(regulation['Statute Name'] || regulation.name || 'Unknown Regulation'),
      TOPIC: this.cleanText(regulation.Topic || regulation.topic || 'General Compliance'),
      STATUTE_NAME: this.cleanText(regulation['Statute Name'] || regulation.statuteName || ''),
      DESCRIPTION: this.cleanText(regulation['Statutory Summary'] || regulation.description || 'No description available'),
      LAST_UPDATED: regulation['Last Updated'] || regulation.lastUpdated || new Date().toLocaleDateString(),
      REPORTING_REQUIREMENTS: this.cleanText(regulation['Reporting Requirements'] || regulation.reportingRequirements || 'See regulation text for details'),
      DEADLINES: this.cleanText(regulation['Deadlines'] || regulation.deadlines || 'See regulation for specific deadlines'),
      ADDITIONAL_RESOURCES_1: this.cleanText(regulation['Additional Resources 1'] || ''),
      ADDITIONAL_RESOURCES_2: this.cleanText(regulation['Additional Resources 2'] || ''),
      STATUTORY_SUMMARY: this.cleanText(regulation['Statutory Summary'] || ''),
      KEY_PROVISIONS: this.generateKeyProvisions(regulation),
      REGULATION_SLUG: this.getRegulationSlug(regulation),
      STATUTE_REFERENCE: this.generateStatuteReference(regulation),
      TOPIC_CATEGORY: this.getTopicCategory(regulation.Topic, regulation['Statute Name']),
      ENFORCEMENT_AGENCY: this.getEnforcementAgency(regulation.Topic, this.getTopicCategory(regulation.Topic, regulation['Statute Name']), regulation['Statute Name']),
      COMPLIANCE_FOCUS: this.getComplianceFocus(regulation.Topic, this.getTopicCategory(regulation.Topic, regulation['Statute Name']), regulation['Statute Name']),
      COMPLIANCE_DEADLINE_INFO: this.generateComplianceDeadlineInfo(regulation),
      REPORTING_SUMMARY: this.generateReportingSummary(regulation)
    };
    
    // Debug logging to see what we're working with
    console.log(`🔧 Generating console for: ${regulationData.REGULATION_NAME}`);
    console.log(`📋 Topic: ${regulationData.TOPIC} (${regulationData.TOPIC_CATEGORY})`);
    console.log(`📖 Statute Reference: ${regulationData.STATUTE_REFERENCE}`);
    console.log(`🏛️ Enforcement Agency: ${regulationData.ENFORCEMENT_AGENCY}`);
    console.log(`🎯 Compliance Focus: ${regulationData.COMPLIANCE_FOCUS}`);

    // Start with the REG-66 template and customize it for this regulation
    let html = this.template;

    // Replace REG-66 specific content with dynamic regulation content
    html = html.replace(/REG-66 Advanced LinearEngine Console/g, `${regulationData.REGULATION_NAME} - Advanced LinearEngine Console`);
    html = html.replace(/REG-66/g, regulationData.REGULATION_ID);
    
    // Ensure WebSocket subscription messages use the correct regulation ID
    html = html.replace(/Subscribed to REG-66 regulation updates/g, `Subscribed to ${regulationData.REGULATION_ID} regulation updates`);
    
    // Special handling for TEACH Act - preserve original content
    if (regulationData.REGULATION_SLUG === 'technology-education-and-copyright-harmonization-a') {
      // For TEACH Act, keep the original USC 17/110 content and endpoints
      console.log('🎯 Preserving original TEACH Act USC content and endpoints');
    } else {
      // For other regulations, replace TEACH Act references with regulation-specific content
      html = html.replace(/TEACH Act/g, regulationData.REGULATION_NAME);
      html = html.replace(/USC 17 Section 110/g, regulationData.STATUTE_REFERENCE);
      html = html.replace(/Copyright & Fair Use Project/g, `${regulationData.COMPLIANCE_FOCUS} Project`);
      html = html.replace(/TEACH Act research database/g, `${regulationData.REGULATION_NAME} research database`);
      html = html.replace(/Educational exemption research/g, `${regulationData.TOPIC} regulatory research`);
      html = html.replace(/Digital copyright analysis/g, `${regulationData.TOPIC} legal analysis`);
      
      // Add comprehensive topic-specific replacements
      html = html.replace(/Department of Education/g, regulationData.ENFORCEMENT_AGENCY);
      html = html.replace(/Educational compliance/g, regulationData.COMPLIANCE_FOCUS);
      html = html.replace(/Copyright compliance/g, `${regulationData.TOPIC} compliance`);
      html = html.replace(/Fair use guidelines/g, `${regulationData.TOPIC} guidelines`);
      html = html.replace(/Educational technology/g, `${regulationData.TOPIC} technology`);
      
      // Replace generic compliance terms with regulation-specific ones
      html = html.replace(/educational institutions/g, this.getInstitutionType(regulationData.TOPIC_CATEGORY));
      html = html.replace(/copyright law/g, `${regulationData.TOPIC} law`);
      html = html.replace(/intellectual property/g, `${regulationData.TOPIC} requirements`);
      
      // Replace hardcoded workflow references with regulation-specific ones
      html = html.replace(/USC 17 Section 110 \(TEACH Act\)/g, `${regulationData.STATUTE_REFERENCE}`);
      html = html.replace(/Copyright Office TEACH Act Guidance/g, `${regulationData.ENFORCEMENT_AGENCY} ${regulationData.REGULATION_NAME} Guidance`);
      html = html.replace(/Copyright Office Fair Housing Act, Section 6 Guidance/g, `${regulationData.ENFORCEMENT_AGENCY} ${regulationData.REGULATION_NAME} Guidance`);
      html = html.replace(/Copyright Office ([^\\n]+) Guidance/g, `${regulationData.ENFORCEMENT_AGENCY} $1 Guidance`);
      html = html.replace(/U\.S\. Copyright Office/g, regulationData.ENFORCEMENT_AGENCY);
      html = html.replace(/Loading official guidance from U\.S\. Copyright Office/g, `Loading official guidance from ${regulationData.ENFORCEMENT_AGENCY}`);
      html = html.replace(/TEACH Act interpretation across institutions/g, `${regulationData.REGULATION_NAME} interpretation across institutions`);
      html = html.replace(/Copyright Office integration and analysis/g, `${regulationData.ENFORCEMENT_AGENCY} integration and analysis`);
      html = html.replace(/digital rights references/g, `${regulationData.TOPIC.toLowerCase()} references`);
      html = html.replace(/copyright analysis references/g, `${regulationData.TOPIC.toLowerCase()} analysis references`);
      html = html.replace(/Copyright & Fair Use Project/g, `${regulationData.COMPLIANCE_FOCUS} Project`);
      
      // Replace university library project references
      html = html.replace(/General Regulatory Compliance Project/g, `${regulationData.COMPLIANCE_FOCUS} Project`);
      
      // Replace additional workflow-specific references
      html = html.replace(/regulatory guidance analysis/g, `${regulationData.TOPIC.toLowerCase()} regulatory guidance analysis`);
      html = html.replace(/Regulatory interpretation updates/g, `${regulationData.REGULATION_NAME} interpretation updates`);
      html = html.replace(/Mapped (\d+) compliance requirements/g, `Mapped $1 ${regulationData.TOPIC.toLowerCase()} compliance requirements`);
      html = html.replace(/compliance requirements/g, `${regulationData.TOPIC.toLowerCase()} compliance requirements`);
      
      // Replace JavaScript hardcoded TEACH Act references
      html = html.replace(/High agreement on TEACH Act interpretation/g, `High agreement on ${regulationData.REGULATION_NAME} interpretation`);
      html = html.replace(/validation rate on TEACH Act interpretation/g, `validation rate on ${regulationData.REGULATION_NAME} interpretation`);
      html = html.replace(/Academic consensus: High agreement on TEACH Act interpretation/g, `Academic consensus: High agreement on ${regulationData.REGULATION_NAME} interpretation`);
      
      // Replace hardcoded workflow step references
      html = html.replace(/STEP 4: Copyright Office integration and analysis/g, `STEP 4: ${regulationData.ENFORCEMENT_AGENCY} integration and analysis`);
      html = html.replace(/TEACH Act regulatory guidance analysis/g, `${regulationData.REGULATION_NAME} regulatory guidance analysis`);
      html = html.replace(/Fetching real CFR TEACH Act guidance from API/g, `Fetching real CFR ${regulationData.REGULATION_NAME} guidance from API`);
      
      // Fix duplicate topic words (e.g., "disabilities disabilities")
      const topicWord = regulationData.TOPIC.toLowerCase();
      const duplicatePattern = new RegExp(`${topicWord}\\s+${topicWord}`, 'g');
      html = html.replace(duplicatePattern, topicWord);
      
      // Inject CSV data into console sections
      html = html.replace(/Reporting Requirements: See regulation text for details/g, `Reporting Requirements: ${regulationData.REPORTING_REQUIREMENTS}`);
      html = html.replace(/Compliance Deadlines: See regulation for specific deadlines/g, `Compliance Deadlines: ${regulationData.DEADLINES}`);
      html = html.replace(/Additional Resources: Contact your compliance office/g, `Additional Resources: ${regulationData.REPORTING_SUMMARY}`);
      
      // Add statutory summary if available
      if (regulationData.STATUTORY_SUMMARY) {
        html = html.replace(/No description available/g, regulationData.STATUTORY_SUMMARY);
        html = html.replace(/General compliance requirements/g, regulationData.STATUTORY_SUMMARY);
      }
    }
    
    // Fix the "unknown" title issue - replace any remaining "unknown" with regulation name
    html = html.replace(/unknown Advanced LinearEngine Console/g, `${regulationData.REGULATION_NAME} Advanced LinearEngine Console`);
    html = html.replace(/Starting unknown COMPREHENSIVE LinearEngine workflow/g, `Starting ${regulationData.REGULATION_NAME} COMPREHENSIVE LinearEngine workflow`);
    html = html.replace(/unknown regulation/g, regulationData.REGULATION_NAME);
    html = html.replace(/Unknown Regulation/g, regulationData.REGULATION_NAME);

    // Update API endpoints to use regulation-specific data
    if (regulationData.REGULATION_SLUG === 'technology-education-and-copyright-harmonization-a') {
      // For TEACH Act, keep original endpoints (USC 17/110, CFR teach-act, compliance teach-act)
      console.log('🎯 Preserving original TEACH Act API endpoints');
    } else {
      // Replace USC 17/110 with the actual statute for this regulation
      const statuteInfo = this.parseStatuteReference(regulationData.STATUTE_REFERENCE, regulation);
      
      // FORCE ALL REGULATIONS TO USE CFR (not USC) - CFR is what institutions follow
      console.log(`🔧 Converting ALL regulations to CFR for ${regulationData.REGULATION_NAME}`);
      html = html.replace(/api\/llm\/usc\/17\/110/g, `api/llm/cfr/${regulationData.REGULATION_SLUG}`);
      
      // Update ALL content to reflect CFR (regardless of original statute type)
      if (statuteInfo.type === 'cfr' && statuteInfo.title && statuteInfo.section) {
        html = html.replace(/USC 17 Section 110/g, `${statuteInfo.title} C.F.R. Part ${statuteInfo.section}`);
      } else {
        // For USC-based regulations, convert to appropriate CFR title
        const cfrTitle = this.getCFRTitleForRegulation(regulationData.REGULATION_SLUG);
        html = html.replace(/USC 17 Section 110/g, `${cfrTitle} C.F.R. Implementation`);
      }
      
      html = html.replace(/United States Code/g, 'Code of Federal Regulations');
      html = html.replace(/USC Text/g, 'CFR Text');
      html = html.replace(/loadRealUSCText/g, 'loadRealCFRText');
      
      // Update CFR endpoints to be regulation-specific
      html = html.replace(/api\/llm\/cfr\/teach-act/g, `api/llm/cfr/${regulationData.REGULATION_SLUG}`);
      html = html.replace(/api\/llm\/compliance\/teach-act/g, `api/llm/compliance/${regulationData.REGULATION_SLUG}`);
      
      // CRITICAL: Inject VISIBLE government source URL into console
      // Replace generic "Government sources" with specific agency source
      html = html.replace(
        /Government sources/g, 
        `Government sources: API endpoint /api/llm/compliance/${regulationData.REGULATION_SLUG}`
      );
      
      // Add government source info to the workflow log
      html = html.replace(
        /Workflow includes: Government sources, Differential analysis, University libraries/g,
        `Workflow includes: Government sources (${regulationData.ENFORCEMENT_AGENCY}), Differential analysis, University libraries`
      );
    }
    
    // Replace any remaining template placeholders
    Object.entries(regulationData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
    });

    return html;
  }

  /**
   * Clean text for HTML output
   * @param {string} text 
   * @returns {string}
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .trim();
  }

  /**
   * Generate key provisions HTML from regulation data
   * @param {Object} regulation 
   * @returns {string}
   */
  generateKeyProvisions(regulation) {
    const provisions = [];
    
    // Extract statute information
    for (let i = 1; i <= 4; i++) {
      const statute = regulation[`Statute ${i}`];
      if (statute && statute.trim()) {
        provisions.push(`<div style="margin-bottom: 8px; padding: 6px; background: #edf2f7; border-radius: 4px; font-size: 0.85em;">${this.cleanText(statute)}</div>`);
      }
    }

    // Extract regulation information
    for (let i = 1; i <= 5; i++) {
      const reg = regulation[`Regulation ${i}`];
      if (reg && reg.trim()) {
        provisions.push(`<div style="margin-bottom: 8px; padding: 6px; background: #e6fffa; border-radius: 4px; font-size: 0.85em;">${this.cleanText(reg)}</div>`);
      }
    }

    return provisions.length > 0 
      ? provisions.join('') 
      : '<div style="color: #718096; font-style: italic;">No specific provisions listed</div>';
  }

  /**
   * Get regulation-friendly filename
   * @param {Object} regulation 
   * @returns {string}
   */
  getRegulationSlug(regulation) {
    const name = regulation['Statute Name'] || regulation.name || 'unknown';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Generate statute reference for regulation
   * @param {Object} regulation 
   * @returns {string}
   */
  generateStatuteReference(regulation) {
    // Try to extract statute references from various fields
    const statute1 = regulation['Statute 1'] || '';
    const statute2 = regulation['Statute 2'] || '';
    const topic = regulation.Topic || '';
    
    if (statute1) {
      return statute1;
    } else if (statute2) {
      return statute2;
    } else if (topic.includes('USC')) {
      return topic;
    } else {
      return `${topic} Regulation`;
    }
  }

  /**
   * Get topic category for regulation-specific customization
   * @param {string} topic 
   * @returns {string}
   */
  getTopicCategory(topic, regulationName = '') {
    if (!topic) return 'general';
    
    const topicLower = topic.toLowerCase();
    const nameLower = regulationName.toLowerCase();
    
    // Check regulation name for civil rights indicators first (higher priority)
    if (nameLower.includes('title ix') || nameLower.includes('title vii') || nameLower.includes('title vi') || 
        nameLower.includes('discrimination') || nameLower.includes('civil rights') || 
        nameLower.includes('ada') || nameLower.includes('disabilities') || nameLower.includes('rehabilitation act') ||
        nameLower.includes('fair housing') || nameLower.includes('housing act')) {
      return 'civil-rights';
    }
    
    // Check for campus safety regulations (Clery Act, etc.)
    if (nameLower.includes('clery') || nameLower.includes('campus security') || nameLower.includes('campus crime') ||
        topicLower.includes('campus safety') || topicLower.includes('campus security')) {
      return 'campus-safety';
    }
    
    if (topicLower.includes('civil rights') || topicLower.includes('discrimination') || topicLower.includes('diversity')) return 'civil-rights';
    if (topicLower.includes('academic') || topicLower.includes('education')) return 'education';
    if (topicLower.includes('health') || topicLower.includes('medical') || topicLower.includes('hipaa')) return 'healthcare';
    if (topicLower.includes('financial') || topicLower.includes('accounting') || topicLower.includes('audit')) return 'financial';
    if (topicLower.includes('employment') || topicLower.includes('human resources')) return 'employment';
    if (topicLower.includes('environmental') || topicLower.includes('safety') && !topicLower.includes('campus')) return 'environmental';
    if (topicLower.includes('research') || topicLower.includes('grants')) return 'research';
    if (topicLower.includes('student') || topicLower.includes('admissions')) return 'student-services';
    
    return 'general';
  }

  /**
   * Get primary enforcement agency based on topic
   * @param {string} topic 
   * @returns {string}
   */
  getEnforcementAgency(topic, topicCategory = '', regulationName = '') {
    if (!topic) return 'Various Federal Agencies';
    
    const topicLower = topic.toLowerCase();
    const nameLower = regulationName.toLowerCase();
    
    // Pennsylvania state regulations
    if (nameLower.includes('pennsylvania') || nameLower.includes('pa ') || 
        nameLower.includes('pa.c.s') || nameLower.includes('pa dept') ||
        nameLower.includes('pa department')) {
      if (nameLower.includes('crime') || nameLower.includes('police')) {
        return 'Pennsylvania State Police (PA-PSP)';
      }
      if (nameLower.includes('ethics') || nameLower.includes('gift')) {
        return 'Pennsylvania State Ethics Commission (PA-SEC)';
      }
      return 'Pennsylvania Department of Education (PA-ED)';
    }
    
    // Campus safety regulations get Department of Education
    if (topicCategory === 'campus-safety' || nameLower.includes('clery') || 
        nameLower.includes('campus security') || nameLower.includes('campus crime') ||
        topicLower.includes('campus safety')) {
      return 'Department of Education (ED)';
    }
    
    // Fair Housing Act gets HUD
    if (nameLower.includes('fair housing') || nameLower.includes('housing act')) {
      return 'Department of Housing and Urban Development (HUD)';
    }
    
    // Civil rights regulations get OCR regardless of topic
    if (topicCategory === 'civil-rights' || 
        nameLower.includes('title ix') || nameLower.includes('title vii') || nameLower.includes('title vi') ||
        nameLower.includes('discrimination') || nameLower.includes('civil rights') ||
        nameLower.includes('ada') || nameLower.includes('disabilities')) {
      return 'Office for Civil Rights (OCR)';
    }
    
    if (topicLower.includes('academic') || topicLower.includes('education') || topicLower.includes('student')) return 'Department of Education (ED)';
    if (topicLower.includes('civil rights') || topicLower.includes('discrimination') || topicLower.includes('title')) return 'Office for Civil Rights (OCR)';
    if (topicLower.includes('health') || topicLower.includes('medical') || topicLower.includes('hipaa')) return 'Department of Health & Human Services (HHS)';
    if (topicLower.includes('financial') || topicLower.includes('accounting') || topicLower.includes('audit')) return 'Department of Treasury / SEC';
    if (topicLower.includes('employment') || topicLower.includes('human resources') || topicLower.includes('labor')) return 'Department of Labor (DOL)';
    if (topicLower.includes('environmental') || topicLower.includes('safety')) return 'Environmental Protection Agency (EPA)';
    if (topicLower.includes('research') || topicLower.includes('grants')) return 'National Science Foundation (NSF)';
    
    return 'Various Federal Agencies';
  }

  /**
   * Get compliance focus area based on topic
   * @param {string} topic 
   * @returns {string}
   */
  getComplianceFocus(topic, topicCategory = '', regulationName = '') {
    if (!topic) return 'General Compliance';
    
    const topicLower = topic.toLowerCase();
    const nameLower = regulationName.toLowerCase();
    
    // Campus safety regulations get specific focus
    if (topicCategory === 'campus-safety' || nameLower.includes('clery') || 
        nameLower.includes('campus security') || nameLower.includes('campus crime') ||
        topicLower.includes('campus safety')) {
      return 'Campus Safety & Security Reporting';
    }
    
    // Fair Housing Act gets specific focus
    if (nameLower.includes('fair housing') || nameLower.includes('housing act')) {
      return 'Fair Housing & Non-Discrimination';
    }
    
    // Civil rights regulations get specific focus
    if (topicCategory === 'civil-rights' || 
        nameLower.includes('title ix') || nameLower.includes('title vii') || nameLower.includes('title vi') ||
        nameLower.includes('discrimination') || nameLower.includes('civil rights') ||
        nameLower.includes('ada') || nameLower.includes('disabilities')) {
      return 'Non-Discrimination & Equal Access';
    }
    
    if (topicLower.includes('academic') || topicLower.includes('education')) return 'Educational Program Compliance';
    if (topicLower.includes('civil rights') || topicLower.includes('discrimination')) return 'Non-Discrimination & Equal Access';
    if (topicLower.includes('health') || topicLower.includes('medical')) return 'Health Information Privacy & Security';
    if (topicLower.includes('financial') || topicLower.includes('accounting')) return 'Financial Reporting & Audit Compliance';
    if (topicLower.includes('employment') || topicLower.includes('human resources')) return 'Employment Law & Workplace Rights';
    if (topicLower.includes('environmental') || topicLower.includes('safety')) return 'Environmental Health & Safety';
    if (topicLower.includes('research') || topicLower.includes('grants')) return 'Research Integrity & Grant Compliance';
    if (topicLower.includes('student') || topicLower.includes('admissions')) return 'Student Rights & Services';
    
    return 'General Regulatory Compliance';
  }

  /**
   * Get appropriate institution type based on topic category
   * @param {string} topicCategory 
   * @returns {string}
   */
  getInstitutionType(topicCategory) {
    switch (topicCategory) {
      case 'education': return 'educational institutions';
      case 'civil-rights': return 'covered entities';
      case 'healthcare': return 'healthcare providers';
      case 'financial': return 'financial institutions';
      case 'employment': return 'employers';
      case 'environmental': return 'regulated facilities';
      case 'research': return 'research institutions';
      case 'student-services': return 'educational institutions';
      default: return 'covered entities';
    }
  }

  /**
   * Get appropriate CFR title based on regulation type
   */
  getCFRTitleForRegulation(regulationSlug) {
    const regulationName = regulationSlug.replace(/-/g, ' ').toLowerCase();
    
    if (regulationName.includes('credit') || regulationName.includes('financial') || regulationName.includes('banking')) {
      return 'Title 12'; // Banking
    } else if (regulationName.includes('tax') || regulationName.includes('irs') || regulationName.includes('revenue')) {
      return 'Title 26'; // Internal Revenue
    } else if (regulationName.includes('antitrust') || regulationName.includes('trade') || regulationName.includes('commerce') || regulationName.includes('clayton') || regulationName.includes('sherman')) {
      return 'Title 16'; // Commercial Practices
    } else if (regulationName.includes('security') || regulationName.includes('sox') || regulationName.includes('securities')) {
      return 'Title 17'; // Commodity and Securities Exchanges
    } else if (regulationName.includes('social') || regulationName.includes('disability') || regulationName.includes('welfare')) {
      return 'Title 20'; // Social Security
    } else if (regulationName.includes('education') || regulationName.includes('ferpa') || regulationName.includes('title-ix')) {
      return 'Title 34'; // Education
    } else if (regulationName.includes('health') || regulationName.includes('hipaa') || regulationName.includes('medical')) {
      return 'Title 45'; // Public Welfare
    } else {
      return 'Title 29'; // Labor (default)
    }
  }

  /**
   * Parse statute reference to extract title and section for API calls
   */
  parseStatuteReference(statuteReference, regulation) {
    // Check if this is a CFR-based regulation first
    const cfrInfo = this.parseCFRReference(regulation);
    if (cfrInfo.isCFR) {
      return cfrInfo;
    }
    
    // Default to USC 17/110 if we can't parse
    let title = '17';
    let section = '110';
    
    if (statuteReference) {
      // PRIORITY 1: Look for "X U.S. Code § Y" or "X U.S.C. § Y" patterns first
      const uscCodeMatch = statuteReference.match(/(\d+)\s+U\.S\.?\s*Code?\s*§\s*(\d+)/i);
      if (uscCodeMatch) {
        title = uscCodeMatch[1];
        section = uscCodeMatch[2];
        console.log(`📋 Parsed USC Code reference: ${title} U.S.C. § ${section}`);
        return { title, section, type: 'usc' };
      }
      
      // PRIORITY 2: Look for "USC X Section Y" patterns
      const uscMatch = statuteReference.match(/USC\s+(\d+).*?Section\s+(\d+)/i);
      if (uscMatch) {
        title = uscMatch[1];
        section = uscMatch[2];
        console.log(`📋 Parsed USC Section reference: USC ${title} Section ${section}`);
        return { title, section, type: 'usc' };
      }
      
      // PRIORITY 3: Try to extract from U.S.C. patterns (e.g., "42 U.S.C. Chapter 21G" -> title: 42, section: 21)
      const uscPatternMatch = statuteReference.match(/(\d+)\s+U\.S\.C\.\s+(?:Chapter\s+)?(\w+)/i);
      if (uscPatternMatch) {
        title = uscPatternMatch[1];
        section = uscPatternMatch[2].replace(/[^0-9]/g, ''); // Extract just the numbers from "21G" -> "21"
        console.log(`📋 Parsed U.S.C. Chapter reference: ${title} U.S.C. Chapter ${section}`);
        return { title, section, type: 'usc' };
      }
      
      // PRIORITY 4: Try to extract from item ID patterns (e.g., "29-794" -> title: 29, section: 794)
      const idMatch = statuteReference.match(/(\d+)-(\d+)/);
      if (idMatch) {
        title = idMatch[1];
        section = idMatch[2];
        console.log(`📋 Parsed ID pattern reference: ${title}-${section}`);
        return { title, section, type: 'usc' };
      }
      
      console.log(`⚠️  Could not parse statute reference: "${statuteReference}", using default USC 17/110`);
    }
    
    return { title, section, type: 'usc' };
  }

  /**
   * Parse CFR reference from regulation data
   */
  parseCFRReference(regulation) {
    // Check Regulation 1-5 fields for CFR patterns
    for (let i = 1; i <= 5; i++) {
      const regField = regulation[`Regulation ${i}`];
      if (regField) {
        // Look for "X C.F.R. Part Y" or "X C.F.R. § Y" patterns
        const cfrMatch = regField.match(/(\d+)\s+C\.F\.R\.\s+(?:Part\s+|§\s+)?(\d+)/i);
        if (cfrMatch) {
          const title = cfrMatch[1];
          const part = cfrMatch[2];
          console.log(`📋 Parsed CFR reference: ${title} C.F.R. Part ${part}`);
          return { 
            title, 
            section: part, 
            type: 'cfr', 
            isCFR: true,
            fullReference: regField
          };
        }
      }
    }
    
    return { isCFR: false };
  }

  generateComplianceDeadlineInfo(regulation) {
    const deadlines = regulation['Deadlines'] || '';
    const reportingReqs = regulation['Reporting Requirements'] || '';
    
    if (!deadlines && !reportingReqs) {
      return 'Ongoing compliance required - see regulation for specific timelines';
    }
    
    let info = '';
    if (deadlines) {
      info += `Deadlines: ${deadlines}`;
    }
    if (reportingReqs && deadlines) {
      info += ' | ';
    }
    if (reportingReqs) {
      info += `Reporting: ${reportingReqs}`;
    }
    
    return info;
  }

  generateReportingSummary(regulation) {
    const reportingReqs = regulation['Reporting Requirements'] || '';
    const additionalRes1 = regulation['Additional Resources 1'] || '';
    const additionalRes2 = regulation['Additional Resources 2'] || '';
    
    let summary = reportingReqs || 'See regulation text for reporting requirements';
    
    if (additionalRes1 || additionalRes2) {
      summary += ' | Additional Resources: ';
      const resources = [additionalRes1, additionalRes2].filter(r => r).join(', ');
      summary += resources;
    }
    
    return summary;
  }
}

export default ConsoleGenerator;
