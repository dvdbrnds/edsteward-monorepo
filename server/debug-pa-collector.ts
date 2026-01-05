import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * This script debugs the PA regulation collection process by:
 * 1. Fetching HTML from source URLs
 * 2. Storing raw HTML for inspection
 * 3. Testing various selectors to find regulation content
 * 4. Analyzing the structure of pages
 */
async function debugPACollector() {
  try {

    // Define PA education regulation sources
    const sources = [
      {
        name: 'PA Dept of Education',
        url: 'https://www.education.pa.gov/Pages/default.aspx',
        description: 'Main PA education department page'
      },
      {
        name: 'PA State Board of Education',
        url: 'https://www.stateboard.education.pa.gov/Pages/default.aspx',
        description: 'State board page'
      },
      {
        name: 'PA Higher Education',
        url: 'https://www.education.pa.gov/Postsecondary-Adult/Pages/default.aspx',
        description: 'Higher education regulations'
      },
      {
        name: 'PA Code Title 22',
        url: 'http://www.pacodeandbulletin.gov/Display/pacode?titleNum=022',
        description: 'PA Code for education'
      }
    ];

    // Create directory for HTML dumps
    const htmlDir = path.join(process.cwd(), 'logs', 'pa-html-dumps');
    if (!fs.existsSync(htmlDir)) {
      fs.mkdirSync(htmlDir, { recursive: true });
    }


    // Process each source
    for (const source of sources) {

      try {
        // Fetch the page HTML
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        if (!response.ok) {
          continue;
        }

        const html = await response.text();

        // Save the HTML for analysis
        const filename = source.name.toLowerCase().replace(/\s+/g, '-') + '.html';
        const filepath = path.join(htmlDir, filename);
        fs.writeFileSync(filepath, html);

        // Parse the HTML
        const $ = cheerio.load(html);

        // Output basic page info

        // Check for SharePoint elements
        const isSharePoint = html.includes('SharePoint') || html.includes('_spPageContextInfo');

        // Check for main content containers
        const containers = [
          '#main-content', 
          'main', 
          '.main-content',
          'article',
          '.ms-rtestate-field',
          '[data-automation-id="CanvasZone"]'
        ];

        containers.forEach(selector => {
          const count = $(selector).length;
        });

        // Look for regulation-related links
        const links = $('a').filter((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim().toLowerCase();
          return (
            href.includes('pacode') ||
            href.includes('pabulletin') ||
            href.includes('regulation') ||
            href.includes('statutes') ||
            text.includes('regulation') ||
            text.includes('code') ||
            text.includes('statute') ||
            text.includes('chapter')
          );
        });

        links.each((i, el) => {
          if (i < 10) { // Limit to first 10 for brevity
          }
        });

        // Test content extraction with common selectors
        [
          '#main-content', 
          'main', 
          '.main-content',
          'article',
          '.ms-rtestate-field',
          '[data-automation-id="CanvasZone"]'
        ].forEach(selector => {
          const element = $(selector).first();
          if (element.length > 0) {
            const text = element.text().trim();
          }
        });

      } catch (error) {
        console.error(`Error processing source ${source.url}:`, error);
      }
    }


  } catch (error) {
    console.error('Debug script failed:', error);
  }
}

// Run the debug function
debugPACollector().catch(console.error);