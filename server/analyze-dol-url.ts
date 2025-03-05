
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

async function analyzeUrl() {
  try {
    const url = "https://www.dol.gov/agencies/oasam/regulatory/statutes/age-discrimination-act";
    console.log(`Analyzing URL: ${url}`);
    
    // Basic URL parsing
    try {
      const urlObj = new URL(url);
      console.log(`Base URL: ${urlObj.protocol}//${urlObj.hostname}`);
      console.log(`Path: ${urlObj.pathname}`);
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
      
      console.log(`Successfully fetched page (${response.status})`);
      console.log(`Content length: ${response.data.length} bytes`);
      
      // Parse the HTML with cheerio
      const $ = cheerio.load(response.data);
      
      // Extract title
      const title = $('title').text().trim();
      console.log(`Page title: ${title}`);
      
      // Find all links on the page
      const links = $('a[href]')
        .map(function() {
          const href = $(this).attr('href');
          const text = $(this).text().trim();
          return { href, text };
        })
        .get()
        .filter(link => link.href && (link.href.startsWith('http') || link.href.startsWith('/')));
      
      console.log(`Found ${links.length} links on the page`);
      
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
      
      console.log(`\nPotential regulation links (${regulationLinks.length}):`);
      regulationLinks.slice(0, 20).forEach((link, i) => {
        console.log(`${i+1}. ${link.text.substring(0, 50)}${link.text.length > 50 ? '...' : ''}`);
        console.log(`   URL: ${link.href}`);
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
