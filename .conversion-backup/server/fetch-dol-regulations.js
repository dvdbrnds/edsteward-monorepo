
import axios from 'axios';
import * as cheerio from 'cheerio';

async function fetchDOLRegulations() {
  try {
    const baseUrl = "https://www.dol.gov/agencies/oasam/regulatory/statutes";
    console.log(`Fetching regulations from: ${baseUrl}`);
    
    // Get the main statutes page
    const response = await axios.get(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });
    
    console.log(`Successfully fetched DOL statutes page (${response.status})`);
    console.log(`Content length: ${response.data.length} bytes`);
    
    const $ = cheerio.load(response.data);
    
    // Find all links that might be statutes
    const statuteLinks = $('a')
      .map(function() {
        const href = $(this).attr('href');
        const text = $(this).text().trim();
        return { href, text };
      })
      .get()
      .filter(link => 
        link.href && 
        link.text && 
        link.text.length > 5 &&
        (
          (link.href.includes('/statutes/')) ||
          (link.text.toLowerCase().includes('act') && !link.text.toLowerCase().includes('contact'))
        )
      );
    
    console.log(`\nFound ${statuteLinks.length} potential statute links:`);
    
    // Print the found statutes
    statuteLinks.forEach((link, index) => {
      const fullUrl = link.href.startsWith('http') 
        ? link.href 
        : `https://www.dol.gov${link.href.startsWith('/') ? '' : '/'}${link.href}`;
      
      console.log(`${index + 1}. ${link.text}`);
      console.log(`   URL: ${fullUrl}`);
    });
    
    return statuteLinks;
  } catch (error) {
    console.error('Error fetching DOL regulations:', error);
    return [];
  }
}

// Run the function
fetchDOLRegulations().catch(console.error);
