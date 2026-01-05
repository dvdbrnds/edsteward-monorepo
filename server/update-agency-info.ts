
import { storage } from './storage';
import { UrlPatternAnalyzer } from './url-pattern-analyzer';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Extracts agency information from agency URLs and updates the regulations
 */
async function updateAgencyInfo() {
  try {
    
    // Get all regulations
    const regulations = await storage.getRegulations();
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each regulation
    for (const regulation of regulations) {
      try {
        // Skip if already has agency name and contact
        if (regulation.agencyName && regulation.agencyContact) {
          skippedCount++;
          continue;
        }
        
        // Skip if no agency URL
        if (!regulation.agency_url) {
          skippedCount++;
          continue;
        }
        
        
        // Extract agency information from the URL
        const updates = await extractAgencyInfoFromUrl(regulation.agency_url);
        
        if (Object.keys(updates).length > 0) {
          // Update the regulation
          await storage.updateRegulation(regulation.id, updates);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error updating agency info for regulation ${regulation.itemId}:`, error);
        errorCount++;
      }
    }
    
    
  } catch (error) {
    console.error('Failed to update agency information:', error);
    throw error;
  }
}

/**
 * Extract agency information from a URL
 */
async function extractAgencyInfoFromUrl(url: string) {
  try {
    if (!url || !url.startsWith('http')) {
      return {};
    }
    
    // Parse the URL to get the domain
    const { hostname } = new URL(url);
    
    // Check if this is a government or educational domain
    const isGovDomain = hostname.endsWith('.gov');
    const isEduDomain = hostname.endsWith('.edu');
    
    // Try to fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 RegulationComplianceBot'
      },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract potential agency information
    const updates: Record<string, any> = {};
    
    // Look for agency name in common locations
    const agencyNameSelectors = [
      'meta[name="og:site_name"]',
      'meta[property="og:site_name"]',
      'header h1',
      '.agency-name',
      '#agency-name',
      '.site-title',
      '#site-title'
    ];
    
    for (const selector of agencyNameSelectors) {
      const element = $(selector);
      if (element.length) {
        const name = element.attr('content') || element.text().trim();
        if (name && name.length > 3) {
          updates.agencyName = name;
          break;
        }
      }
    }
    
    // If no agency name found, derive from hostname
    if (!updates.agencyName) {
      // Convert domain to agency name
      // e.g., "ed.gov" -> "Department of Education"
      if (isGovDomain) {
        const domainParts = hostname.split('.');
        const agencyCode = domainParts[0];
        
        // Map common government domain prefixes to agency names
        const agencyMap: Record<string, string> = {
          'ed': 'Department of Education',
          'dol': 'Department of Labor',
          'epa': 'Environmental Protection Agency',
          'irs': 'Internal Revenue Service',
          'ssa': 'Social Security Administration',
          'fcc': 'Federal Communications Commission',
          'hhs': 'Department of Health and Human Services',
          'doi': 'Department of Interior',
          'dhs': 'Department of Homeland Security',
          'usda': 'Department of Agriculture',
          'energy': 'Department of Energy',
          'dot': 'Department of Transportation',
          'justice': 'Department of Justice',
          'va': 'Department of Veterans Affairs',
          'sec': 'Securities and Exchange Commission',
          'census': 'Census Bureau',
          'nlrb': 'National Labor Relations Board',
          'eeoc': 'Equal Employment Opportunity Commission',
          'ftc': 'Federal Trade Commission',
          'fda': 'Food and Drug Administration',
          'cdc': 'Centers for Disease Control and Prevention',
          'nih': 'National Institutes of Health',
          'nsf': 'National Science Foundation',
          'nps': 'National Park Service',
          'nasa': 'National Aeronautics and Space Administration'
        };
        
        if (agencyMap[agencyCode]) {
          updates.agencyName = agencyMap[agencyCode];
        } else {
          updates.agencyName = hostname.replace('.gov', '').toUpperCase();
        }
      } else if (isEduDomain) {
        // For educational institutions, use the hostname
        const nameParts = hostname.split('.');
        updates.agencyName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
      }
    }
    
    // Look for contact information
    const contactSelectors = [
      'a[href^="mailto:"]',
      '.contact-email',
      '#contact-email',
      '.contact-info',
      '#contact-info',
      '.contact',
      '#contact'
    ];
    
    for (const selector of contactSelectors) {
      const element = $(selector);
      if (element.length) {
        const emailHref = element.attr('href');
        const emailText = element.text().trim();
        
        // Extract email from href
        if (emailHref && emailHref.startsWith('mailto:')) {
          updates.agencyContact = emailHref.substring(7);
          break;
        }
        
        // Extract email from text using regex
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
        const match = emailText.match(emailRegex);
        if (match) {
          updates.agencyContact = match[0];
          break;
        }
      }
    }
    
    // Look for department information
    const departmentSelectors = [
      '.department-name',
      '#department-name',
      '.office-name',
      '#office-name'
    ];
    
    for (const selector of departmentSelectors) {
      const element = $(selector);
      if (element.length) {
        const departmentText = element.text().trim();
        if (departmentText && departmentText.length > 3) {
          updates.agencyDepartment = departmentText;
          break;
        }
      }
    }
    
    return updates;
  } catch (error) {
    console.error(`Error extracting agency info from URL ${url}:`, error);
    return {};
  }
}

// Only run directly if called from the command line
if (require.main === module) {
  updateAgencyInfo().catch(console.error);
}

export { updateAgencyInfo, extractAgencyInfoFromUrl };
