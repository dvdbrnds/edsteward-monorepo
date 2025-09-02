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
   * Generate a regulation-specific console page
   * @param {Object} regulation - Regulation data from CSV
   * @returns {string} - Generated HTML content
   */
  generateConsole(regulation) {
    if (!this.template) {
      throw new Error('Console template not loaded');
    }

    // Extract and clean regulation data
    const regulationData = {
      REGULATION_ID: regulation['Item ID'] || regulation.id || 'REG-' + Date.now(),
      REGULATION_NAME: this.cleanText(regulation['Statute Name'] || regulation.name || 'Unknown Regulation'),
      TOPIC: this.cleanText(regulation.Topic || regulation.topic || 'General Compliance'),
      STATUTE_NAME: this.cleanText(regulation['Statute Name'] || regulation.statuteName || ''),
      DESCRIPTION: this.cleanText(regulation['Statutory Summary'] || regulation.description || 'No description available'),
      LAST_UPDATED: regulation['Last Updated'] || regulation.lastUpdated || new Date().toLocaleDateString(),
      REPORTING_REQUIREMENTS: this.cleanText(regulation['Reporting Requirements'] || regulation.reportingRequirements || 'See regulation text for details'),
      KEY_PROVISIONS: this.generateKeyProvisions(regulation),
      REGULATION_SLUG: this.getRegulationSlug(regulation),
      STATUTE_REFERENCE: this.generateStatuteReference(regulation)
    };
    
    // Debug logging to see what we're working with
    console.log(`🔧 Generating console for: ${regulationData.REGULATION_NAME}`);
    console.log(`📋 Topic: ${regulationData.TOPIC}`);
    console.log(`📖 Statute Reference: ${regulationData.STATUTE_REFERENCE}`);

    // Start with the REG-66 template and customize it for this regulation
    let html = this.template;

    // Replace REG-66 specific content with dynamic regulation content
    html = html.replace(/REG-66 Advanced LinearEngine Console/g, `${regulationData.REGULATION_NAME} - Advanced LinearEngine Console`);
    html = html.replace(/REG-66/g, regulationData.REGULATION_ID);
    
    // Special handling for TEACH Act - preserve original content
    if (regulationData.REGULATION_SLUG === 'technology-education-and-copyright-harmonization-a') {
      // For TEACH Act, keep the original USC 17/110 content and endpoints
      console.log('🎯 Preserving original TEACH Act USC content and endpoints');
    } else {
      // For other regulations, replace TEACH Act references with regulation-specific content
      html = html.replace(/TEACH Act/g, regulationData.REGULATION_NAME);
      html = html.replace(/USC 17 Section 110/g, regulationData.STATUTE_REFERENCE);
      html = html.replace(/Copyright & Fair Use Project/g, `${regulationData.TOPIC} & Compliance Project`);
      html = html.replace(/TEACH Act research database/g, `${regulationData.REGULATION_NAME} research database`);
      html = html.replace(/Educational exemption research/g, `${regulationData.TOPIC} regulatory research`);
      html = html.replace(/Digital copyright analysis/g, `${regulationData.TOPIC} legal analysis`);
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
      
      if (statuteInfo.type === 'cfr') {
        // For CFR-based regulations, replace USC endpoints with CFR endpoints
        console.log(`🔧 Converting USC endpoints to CFR for ${regulationData.REGULATION_NAME}`);
        html = html.replace(/api\/llm\/usc\/17\/110/g, `api/llm/cfr/${statuteInfo.title}/${statuteInfo.section}`);
        
        // Update the USC section title and content to reflect CFR
        html = html.replace(/USC 17 Section 110/g, `${statuteInfo.title} C.F.R. Part ${statuteInfo.section}`);
        html = html.replace(/United States Code/g, 'Code of Federal Regulations');
        html = html.replace(/USC Text/g, 'CFR Text');
        html = html.replace(/loadRealUSCText/g, 'loadRealCFRText');
        
        // Replace USC data processing logic with CFR data processing logic
        html = html.replace(
          /const contentParagraphs = \(uscData\.fullText \|\| uscData\.content\)\.split\('\\n\\n'\)\.filter\(p => p\.trim\(\)\.length > 0\);/g,
          'const cfrSections = uscData.sections || [];'
        );
        
        // Replace USC paragraph processing with CFR section processing
        html = html.replace(
          /contentParagraphs\.forEach\(\(paragraph, index\) => \{[\s\S]*?\}\);/g,
          `cfrSections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'subsection';
            sectionDiv.style.marginBottom = '20px';
            sectionDiv.style.padding = '16px';
            sectionDiv.style.border = '1px solid #e1e4e8';
            sectionDiv.style.borderRadius = '6px';
            
            const title = document.createElement('strong');
            title.textContent = \`\${section.section || ''} \${section.title}\`;
            title.style.display = 'block';
            title.style.marginBottom = '12px';
            title.style.color = '#0969da';
            title.style.fontSize = '16px';
            
            sectionDiv.appendChild(title);
            
            if (typeof section.content === 'string') {
              const contentDiv = document.createElement('div');
              contentDiv.style.lineHeight = '1.6';
              contentDiv.style.color = '#24292f';
              contentDiv.textContent = section.content;
              sectionDiv.appendChild(contentDiv);
            } else if (Array.isArray(section.content)) {
              section.content.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'definition';
                itemDiv.style.marginBottom = '12px';
                
                const itemTitle = document.createElement('strong');
                itemTitle.textContent = \`\${item.provision}:\`;
                
                const itemDesc = document.createElement('span');
                itemDesc.textContent = \` \${item.description}\`;
                
                itemDiv.appendChild(itemTitle);
                itemDiv.appendChild(itemDesc);
                
                if (item.details) {
                  const details = document.createElement('div');
                  details.textContent = item.details;
                  details.style.marginTop = '4px';
                  details.style.fontSize = '13px';
                  details.style.color = '#6e7681';
                  itemDiv.appendChild(details);
                }
                
                sectionDiv.appendChild(itemDiv);
              });
            }
            
            mainSection.appendChild(sectionDiv);
          });`
        );
        
      } else if (statuteInfo.title && statuteInfo.section) {
        // For USC-based regulations, replace with correct USC reference
        html = html.replace(/api\/llm\/usc\/17\/110/g, `api/llm/usc/${statuteInfo.title}/${statuteInfo.section}`);
        html = html.replace(/USC 17 Section 110/g, `USC ${statuteInfo.title} Section ${statuteInfo.section}`);
      }
      
      // Update CFR endpoints to be regulation-specific
      html = html.replace(/api\/llm\/cfr\/teach-act/g, `api/llm/cfr/${regulationData.REGULATION_SLUG}`);
      html = html.replace(/api\/llm\/compliance\/teach-act/g, `api/llm/compliance/${regulationData.REGULATION_SLUG}`);
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
}

export default ConsoleGenerator;
