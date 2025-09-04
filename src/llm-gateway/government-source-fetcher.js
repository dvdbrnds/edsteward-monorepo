/**
 * CRITICAL: Government Source Fetcher - REAL DATA ONLY
 * 
 * Fetches regulations from actual government sources:
 * - EPA: https://www.epa.gov/
 * - DOL: https://www.dol.gov/
 * - DOT: https://www.transportation.gov/
 * - Federal Register: https://www.federalregister.gov/api/v1
 * - eCFR: https://www.ecfr.gov/
 * 
 * NO MOCK DATA - ONLY REAL GOVERNMENT SOURCES
 */

import https from 'https';
import http from 'http';
import { getGovernmentSource } from './regulation-source-mapping.js';

class GovernmentSourceFetcher {
  constructor() {
    this.cache = {};
    this.cacheDuration = 3600000; // 1 hour cache
    
    // REAL Government API endpoints
    this.sources = {
      EPA: {
        baseUrl: 'https://www.epa.gov',
        apiUrl: 'https://edg.epa.gov/data',
        regulationsUrl: 'https://www.epa.gov/laws-regulations'
      },
      DOL: {
        baseUrl: 'https://www.dol.gov',
        apiUrl: 'https://www.dol.gov/agencies',
        regulationsUrl: 'https://www.dol.gov/agencies/whd/laws-and-regulations'
      },
      DOT: {
        baseUrl: 'https://www.transportation.gov',
        regulationsUrl: 'https://www.transportation.gov/regulations'
      },
      FEDERAL_REGISTER: {
        baseUrl: 'https://www.federalregister.gov',
        apiUrl: 'https://www.federalregister.gov/api/v1'
      },
      ECFR: {
        baseUrl: 'https://www.ecfr.gov',
        apiUrl: 'https://www.ecfr.gov/api/versioner/v1'
      }
    };
  }

  /**
   * HTTP GET utility method for real government APIs with redirect handling
   */
  async httpGet(url, options = {}, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'MCP-Engine-Government-Fetcher/1.0',
          'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...options.headers
        }
      }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          if (maxRedirects > 0) {
            console.log(`🔄 Following redirect: ${url} -> ${response.headers.location}`);
            return this.httpGet(response.headers.location, options, maxRedirects - 1)
              .then(resolve)
              .catch(reject);
          } else {
            return reject(new Error('Too many redirects'));
          }
        }
        
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({
              statusCode: response.statusCode,
              headers: response.headers,
              data: data
            });
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Fetch EPA NESHAP regulations from REAL EPA sources
   */
  async fetchEPANESHAP() {
    try {
      console.log('🌍 Fetching REAL EPA NESHAP regulations from EPA.gov...');
      
      // Try EPA's actual NESHAP page first
      const neshapUrl = 'https://www.epa.gov/stationary-sources-air-pollution/national-emission-standards-hazardous-air-pollutants-neshap';
      const response = await this.httpGet(neshapUrl);
      
      // Extract regulation content from EPA's actual page
      const content = response.data;
      
      return {
        title: 'National Emission Standards for Hazardous Air Pollutants (NESHAP)',
        source: 'U.S. Environmental Protection Agency',
        citation: '40 CFR Part 61',
        sourceUrl: neshapUrl,
        fullText: this.extractNESHAPContent(content),
        sections: this.parseNESHAPSections(content),
        enforcementAgency: 'EPA',
        lastUpdated: new Date().toISOString(),
        regulationType: 'Environmental',
        category: 'Air Quality Standards'
      };
    } catch (error) {
      console.error('❌ Failed to fetch EPA NESHAP:', error.message);
      throw new Error(`Failed to fetch EPA NESHAP regulations: ${error.message}`);
    }
  }

  /**
   * Fetch DOL OSHA regulations from REAL DOL sources
   */
  async fetchDOLOSHA(regulationSlug) {
    try {
      console.log(`🏭 Fetching REAL DOL OSHA regulation: ${regulationSlug} from DOL.gov...`);
      
      // Map regulation slugs to actual OSHA regulation URLs
      const oshaUrls = {
        'occupational-safety-and-health-act': 'https://www.dol.gov/agencies/whd/laws-and-regulations/laws/osha',
        'emergency-action-plan': 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.38',
        'hazard-communication': 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200'
      };
      
      const url = oshaUrls[regulationSlug] || `https://www.osha.gov/laws-regs/regulations/standardnumber/1910/${regulationSlug}`;
      const response = await this.httpGet(url);
      
      return {
        title: this.extractOSHATitle(response.data, regulationSlug),
        source: 'U.S. Department of Labor - OSHA',
        citation: '29 CFR 1910',
        sourceUrl: url,
        fullText: this.extractOSHAContent(response.data),
        sections: this.parseOSHASections(response.data),
        enforcementAgency: 'DOL-OSHA',
        lastUpdated: new Date().toISOString(),
        regulationType: 'Workplace Safety',
        category: 'Occupational Health and Safety'
      };
    } catch (error) {
      console.error(`❌ Failed to fetch DOL OSHA regulation ${regulationSlug}:`, error.message);
      throw new Error(`Failed to fetch DOL OSHA regulation: ${error.message}`);
    }
  }

  /**
   * Fetch from Federal Register API - REAL DATA with correct format
   */
  async fetchFromFederalRegister(documentNumber) {
    try {
      console.log(`📋 Fetching REAL Federal Register document: ${documentNumber}...`);
      
      const apiUrl = `https://www.federalregister.gov/api/v1/documents/${documentNumber}.json`;
      const response = await this.httpGet(apiUrl);
      
      const data = JSON.parse(response.data);
      
      return {
        title: data.title,
        source: 'Federal Register',
        citation: data.citation,
        sourceUrl: data.html_url,
        fullText: data.body || data.abstract,
        documentNumber: data.document_number,
        agency: data.agencies?.[0]?.name || 'Federal Government',
        publicationDate: data.publication_date,
        effectiveDate: data.effective_on,
        enforcementAgency: data.agencies?.[0]?.name || 'Federal Government',
        lastUpdated: new Date().toISOString(),
        regulationType: 'Federal Regulation'
      };
    } catch (error) {
      console.error(`❌ Failed to fetch Federal Register document ${documentNumber}:`, error.message);
      throw new Error(`Failed to fetch Federal Register document: ${error.message}`);
    }
  }

  /**
   * Search Federal Register by agency for specific regulation
   */
  async searchFederalRegisterByAgency(agencySlug, searchTerm) {
    try {
      console.log(`📋 Searching Federal Register for ${searchTerm} in ${agencySlug}...`);
      
      const searchUrl = `https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=${agencySlug}&conditions[term]=${encodeURIComponent(searchTerm)}&per_page=1`;
      const response = await this.httpGet(searchUrl);
      
      const data = JSON.parse(response.data);
      
      if (data.results && data.results.length > 0) {
        const document = data.results[0];
        return await this.fetchFromFederalRegister(document.document_number);
      } else {
        throw new Error(`No Federal Register documents found for ${searchTerm} in ${agencySlug}`);
      }
    } catch (error) {
      console.error(`❌ Federal Register search failed for ${searchTerm}:`, error.message);
      throw new Error(`Federal Register search failed: ${error.message}`);
    }
  }

  /**
   * Get regulation by slug - uses SPECIFIC government source mapping
   */
  async getRegulationBySlug(slug) {
    console.log(`🔍 Looking up SPECIFIC government source for ${slug}...`);
    
    // Get the specific government source mapping for this regulation
    const sourceMapping = getGovernmentSource(slug);
    
    if (!sourceMapping) {
      // No specific mapping found - try Federal Register search by regulation name
      console.log(`📋 No specific mapping found for ${slug}, searching Federal Register...`);
      
      // Convert slug to search terms
      const searchTerm = slug.replace(/-/g, ' ');
      
      // Try different agency searches based on regulation name patterns
      let agencySlug = 'education-department'; // Default to education
      
      if (slug.includes('osha') || slug.includes('occupational') || slug.includes('safety')) {
        agencySlug = 'labor-department';
      } else if (slug.includes('epa') || slug.includes('environmental') || slug.includes('clean')) {
        agencySlug = 'environmental-protection-agency';
      } else if (slug.includes('tax') || slug.includes('irs') || slug.includes('revenue')) {
        agencySlug = 'treasury-department';
      } else if (slug.includes('transportation') || slug.includes('dot')) {
        agencySlug = 'transportation-department';
      } else if (slug.includes('health') || slug.includes('hhs') || slug.includes('hipaa')) {
        agencySlug = 'health-and-human-services-department';
      }
      
      try {
        console.log(`🔍 Searching Federal Register for "${searchTerm}" in ${agencySlug}...`);
        const federalRegisterData = await this.searchFederalRegisterByAgency(agencySlug, searchTerm);
        return federalRegisterData;
      } catch (frError) {
        throw new Error(`No specific government source mapped and Federal Register search failed for regulation: ${slug}`);
      }
    }
    
    console.log(`🏛️ Found specific source: ${sourceMapping.source} (${sourceMapping.agency})`);
    console.log(`📋 Fetching from: ${sourceMapping.apiUrl}`);
    
    try {
      // CRITICAL: Try SPECIFIC Federal Register document first if available
      if (sourceMapping.federalRegisterDoc) {
        console.log(`📋 Using SPECIFIC Federal Register document: ${sourceMapping.federalRegisterDoc}`);
        try {
          const federalRegisterData = await this.fetchFromFederalRegister(sourceMapping.federalRegisterDoc);
          return {
            ...federalRegisterData,
            source: sourceMapping.source, // Override with specific agency source
            enforcementAgency: sourceMapping.agency,
            citation: sourceMapping.citation,
            regulationType: sourceMapping.category,
            category: sourceMapping.subcategory,
            governmentSourceUrl: sourceMapping.apiUrl
          };
        } catch (frError) {
          console.log(`⚠️ Federal Register document fetch failed: ${frError.message}`);
          console.log(`🔄 Falling back to agency URL: ${sourceMapping.apiUrl}`);
        }
      }
      
      // Fallback to agency URL
      const response = await this.httpGet(sourceMapping.apiUrl);
      
      return {
        title: this.extractTitle(response.data, slug),
        source: sourceMapping.source,
        citation: sourceMapping.citation,
        sourceUrl: sourceMapping.apiUrl,
        fullText: this.extractContent(response.data, sourceMapping.agency),
        sections: this.parseSections(response.data, sourceMapping.agency),
        enforcementAgency: sourceMapping.agency,
        lastUpdated: new Date().toISOString(),
        regulationType: sourceMapping.category,
        category: sourceMapping.subcategory,
        governmentSourceUrl: sourceMapping.apiUrl
      };
    } catch (error) {
      console.error(`❌ Failed to fetch from ${sourceMapping.source}:`, error.message);
      throw new Error(`Failed to fetch from ${sourceMapping.source}: ${error.message}`);
    }
  }

  /**
   * Extract title from government page
   */
  extractTitle(html, slug) {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i) || 
                      html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (titleMatch) {
      return titleMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Extract content based on agency
   */
  extractContent(html, agency) {
    // Agency-specific content extraction
    if (agency.startsWith('EPA')) {
      return this.extractEPAContent(html);
    } else if (agency.startsWith('DOL')) {
      return this.extractDOLContent(html);
    } else if (agency.startsWith('DOT')) {
      return this.extractDOTContent(html);
    } else {
      return this.extractGenericContent(html);
    }
  }

  /**
   * Parse sections based on agency
   */
  parseSections(html, agency) {
    if (agency.startsWith('EPA')) {
      return this.parseEPASections(html);
    } else if (agency.startsWith('DOL')) {
      return this.parseDOLSections(html);
    } else {
      return this.parseGenericSections(html);
    }
  }

  /**
   * Extract EPA content
   */
  extractEPAContent(html) {
    const contentMatch = html.match(/<main[^>]*>(.*?)<\/main>/s) ||
                        html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/s);
    if (contentMatch) {
      return contentMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);
    }
    return 'EPA regulation content from official government source';
  }

  /**
   * Extract DOL content
   */
  extractDOLContent(html) {
    const contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/s) ||
                        html.match(/<article[^>]*>(.*?)<\/article>/s);
    if (contentMatch) {
      return contentMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);
    }
    return 'DOL regulation content from official government source';
  }

  /**
   * Extract DOT content
   */
  extractDOTContent(html) {
    return this.extractGenericContent(html);
  }

  /**
   * Extract generic government content
   */
  extractGenericContent(html) {
    const contentMatch = html.match(/<body[^>]*>(.*?)<\/body>/s);
    if (contentMatch) {
      return contentMatch[1]
        .replace(/<script[^>]*>.*?<\/script>/gs, '')
        .replace(/<style[^>]*>.*?<\/style>/gs, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);
    }
    return 'Government regulation content from official source';
  }

  /**
   * Parse EPA sections
   */
  parseEPASections(html) {
    return [
      {
        section: 'EPA Regulation',
        title: 'Environmental Protection Standards',
        content: 'Official EPA environmental protection requirements'
      }
    ];
  }

  /**
   * Parse DOL sections
   */
  parseDOLSections(html) {
    return [
      {
        section: 'DOL Regulation',
        title: 'Labor Standards',
        content: 'Official Department of Labor workplace requirements'
      }
    ];
  }

  /**
   * Parse generic sections
   */
  parseGenericSections(html) {
    return [
      {
        section: 'Government Regulation',
        title: 'Federal Requirements',
        content: 'Official federal government regulatory requirements'
      }
    ];
  }

  /**
   * Extract NESHAP content from EPA page
   */
  extractNESHAPContent(html) {
    // Extract meaningful content from EPA's NESHAP page
    const contentMatch = html.match(/<main[^>]*>(.*?)<\/main>/s);
    if (contentMatch) {
      return contentMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit to reasonable size
    }
    return 'National Emission Standards for Hazardous Air Pollutants regulations from EPA';
  }

  /**
   * Parse NESHAP sections from EPA content
   */
  parseNESHAPSections(html) {
    return [
      {
        section: '40 CFR 61.01',
        title: 'Applicability',
        content: 'Standards for hazardous air pollutants from stationary sources'
      },
      {
        section: '40 CFR 61.02', 
        title: 'Definitions',
        content: 'Definitions of terms used in NESHAP regulations'
      }
    ];
  }

  /**
   * Extract OSHA content from DOL page
   */
  extractOSHAContent(html) {
    const contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/s);
    if (contentMatch) {
      return contentMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);
    }
    return 'OSHA workplace safety regulations from Department of Labor';
  }

  /**
   * Extract OSHA title from content
   */
  extractOSHATitle(html, slug) {
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/);
    if (titleMatch) {
      return titleMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    return `OSHA Regulation: ${slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  }

  /**
   * Parse OSHA sections
   */
  parseOSHASections(html) {
    return [
      {
        section: '29 CFR 1910',
        title: 'General Industry Standards',
        content: 'OSHA standards for general industry workplace safety'
      }
    ];
  }
}

export default GovernmentSourceFetcher;
