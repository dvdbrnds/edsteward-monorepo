
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

async function analyzeUrl() {
  try {
    const url = "https://www.dol.gov/agencies/oasam/regulatory/statutes/age-discrimination-act";
    
    // Basic URL parsing
    try {
      const urlObj = new URL(url);
    } catch (error) {
      console.error('Error parsing URL:', error);
    }
    
    // Fetch the page
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 RegulationComplianceBot'
        },
        timeout: 15000
      });
      
      
      // Parse the HTML with cheerio
      const $ = cheerio.load(response.data);
      
      // Extract title
      const title = $('title').text().trim();
      
      // Find all links on the page
      const links = $('a[href]')
        .map(function() {
          const href = $(this).attr('href');
          const text = $(this).text().trim();
          return { href, text };
        })
        .get()
        .filter(link => link.href && (link.href.startsWith('http') || link.href.startsWith('/')));
      
      
      // Find potential regulation links
      const regulationLinks = links.filter(link => {
        const href = link.href.toLowerCase();
        return (
          href.includes('/statutes/') || 
          href.includes('/regulations/') || 
          href.includes('/regulatory/') ||
          href.includes('/laws/') ||
          href.includes('act') ||
          href.includes('statute')
        );
      });
      
      regulationLinks.slice(0, 20).forEach((link, i) => {
      });
      
    } catch (error) {
      console.error('Error fetching or parsing page:', error);
    }
  } catch (error) {
    console.error('Top-level error:', error);
  }
}

// Run the analyzer
analyzeUrl().catch(error => {
  console.error('Fatal error running analyzer:', error);
});
