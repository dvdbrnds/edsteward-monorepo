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
      REGULATION_ID: regulation['Item ID'] || regulation.id || 'unknown',
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

    // Start with the REG-66 template and customize it for this regulation
    let html = this.template;

    // Replace REG-66 specific content with dynamic regulation content
    html = html.replace(/FERPA Section 66 - Advanced LinearEngine Template/g, `${regulationData.REGULATION_NAME} - Advanced LinearEngine Console`);
    html = html.replace(/REG-66/g, regulationData.REGULATION_ID);
    html = html.replace(/TEACH Act/g, regulationData.TOPIC);
    html = html.replace(/USC 17 Section 110/g, regulationData.STATUTE_REFERENCE);
    html = html.replace(/Copyright & Fair Use Project/g, `${regulationData.TOPIC} & Compliance Project`);
    html = html.replace(/TEACH Act research database/g, `${regulationData.TOPIC} research database`);
    html = html.replace(/Educational exemption research/g, `${regulationData.TOPIC} regulatory research`);
    html = html.replace(/Digital copyright analysis/g, `${regulationData.TOPIC} legal analysis`);

    // Update API endpoints to use the correct regulation ID
    html = html.replace(/api\/llm\/usc\/17\/110/g, `api/llm/regulation/${encodeURIComponent(regulationData.REGULATION_ID)}`);
    
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
}

export default ConsoleGenerator;
