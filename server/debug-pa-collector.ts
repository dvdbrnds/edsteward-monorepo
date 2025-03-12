import { storage } from './storage';
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
    console.log('==== PA Regulation Collector Debug ====');

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

    console.log(`\nFetching HTML from ${sources.length} sources...`);

    // Process each source
    for (const source of sources) {
      console.log(`\nProcessing source: ${source.name}`);
      console.log(`URL: ${source.url}`);

      try {
        // Fetch the page HTML
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        if (!response.ok) {
          console.log(`Failed to fetch URL: ${response.status} ${response.statusText}`);
          continue;
        }

        const html = await response.text();

        // Save the HTML for analysis
        const filename = source.name.toLowerCase().replace(/\s+/g, '-') + '.html';
        const filepath = path.join(htmlDir, filename);
        fs.writeFileSync(filepath, html);
        console.log(`Saved HTML to ${filepath}`);

        // Parse the HTML
        const $ = cheerio.load(html);

        // Output basic page info
        console.log(`Page title: ${$('title').text().trim()}`);
        console.log(`Body classes: ${$('body').attr('class')}`);

        // Check for SharePoint elements
        const isSharePoint = html.includes('SharePoint') || html.includes('_spPageContextInfo');
        console.log(`Is SharePoint page: ${isSharePoint ? 'Yes' : 'No'}`);

        // Check for main content containers
        const containers = [
          '#main-content', 
          'main', 
          '.main-content',
          'article',
          '.ms-rtestate-field',
          '[data-automation-id="CanvasZone"]'
        ];

        console.log('\nContent Containers:');
        containers.forEach(selector => {
          const count = $(selector).length;
          console.log(`- ${selector}: ${count} elements`);
        });

        // Look for regulation-related links
        console.log('\nRegulation-related links:');
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

        console.log(`Found ${links.length} regulation-related links`);
        links.each((i, el) => {
          if (i < 10) { // Limit to first 10 for brevity
            console.log(`  Link: ${$(el).attr('href')}, Text: ${$(el).text().trim().substring(0, 50)}`);
          }
        });

        // Test content extraction with common selectors
        console.log('\nContent Extraction Test:');
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
            console.log(`${selector} content length: ${text.length} characters`);
            console.log(`${selector} content preview: ${text.substring(0, 150)}...`);
          }
        });

      } catch (error) {
        console.error(`Error processing source ${source.url}:`, error);
      }
    }

    console.log('\n\n==== Debug Script Complete ====');
    console.log(`Check the logs directory at ${htmlDir} for raw HTML files`);

  } catch (error) {
    console.error('Debug script failed:', error);
  }
}

// Run the debug function
debugPACollector().catch(console.error);