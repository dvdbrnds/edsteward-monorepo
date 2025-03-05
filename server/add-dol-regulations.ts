
import { UrlPatternAnalyzer } from './url-pattern-analyzer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { storage } from './storage';

/**
 * Extract regulations from the DOL website
 */
async function addDOLRegulations() {
  try {
    const baseUrl = "https://www.dol.gov/agencies/oasam/regulatory/statutes";
    console.log(`Fetching regulations from: ${baseUrl}`);
    
    // Get the main statutes page
    const response = await axios.get(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 RegulationComplianceBot'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Find all links to statutes
    const statuteLinks = $('a[href*="/statutes/"]')
      .map(function() {
        const href = $(this).attr('href');
        const title = $(this).text().trim();
        return { href, title };
      })
      .get()
      .filter(link => link.href && link.title && !link.href.includes('#') && link.href.includes('/statutes/'));
    
    console.log(`Found ${statuteLinks.length} potential statute links`);
    
    // Process each statute
    for (const link of statuteLinks) {
      try {
        // Normalize the URL
        const url = link.href.startsWith('http') 
          ? link.href 
          : `https://www.dol.gov${link.href.startsWith('/') ? '' : '/'}${link.href}`;
        
        // Check if regulation already exists
        const existingRegulations = await storage.searchRegulations(link.title);
        if (existingRegulations.length > 0) {
          console.log(`Regulation "${link.title}" already exists, skipping...`);
          continue;
        }
        
        // Create new regulation
        const regulation = {
          name: link.title,
          description: `Department of Labor statute: ${link.title}`,
          agency_url: url,
          category: "Labor",
          agencyName: "Department of Labor",
          jurisdiction: "federal",
          isApplicable: true,
          itemId: `DOL-${link.href.split('/').pop()}`,
          regulationType: "Statute"
        };
        
        console.log(`Adding regulation: ${regulation.name}`);
        await storage.createRegulation(regulation);
      } catch (error) {
        console.error(`Error processing statute ${link.title}:`, error);
      }
    }
    
    console.log('DOL regulations import complete');
  } catch (error) {
    console.error('Error fetching DOL regulations:', error);
  }
}

// Run the function
addDOLRegulations();
