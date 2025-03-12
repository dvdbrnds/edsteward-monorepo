
import { paRegulationCollector } from './services/pa-regulation-collector';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

/**
 * Debug script for PA regulation collector
 * This script will:
 * 1. Log all source URLs being scraped
 * 2. Save raw HTML for inspection
 * 3. Log detailed extraction steps
 * 4. Output detailed parsing information
 */
async function debugPARegulationCollector() {
  try {
    console.log('==== PA Regulation Collector Debug ====');
    console.log('Starting detailed debugging of PA regulation collection process...');
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    const htmlDir = path.join(logsDir, 'pa_html_samples');
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }
    
    if (!fs.existsSync(htmlDir)) {
      fs.mkdirSync(htmlDir);
    }
    
    // Get all source URLs
    const sources = paRegulationCollector.getSources ? 
      paRegulationCollector.getSources() : 
      []; // This assumes there's a getSources method, if not we'll need to modify the code
    
    console.log(`\nFound ${sources.length} source URLs to process:`);
    sources.forEach((source, index) => {
      console.log(`${index + 1}. ${source.url} (${source.agency})`);
    });
    
    // Process each source
    for (const source of sources) {
      console.log(`\n\n==== Processing Source: ${source.url} ====`);
      console.log(`Agency: ${source.agency}`);
      
      try {
        // Fetch the HTML content
        console.log('Fetching HTML content...');
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch source: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const html = await response.text();
        console.log(`Received ${html.length} bytes of HTML`);
        
        // Save raw HTML for inspection
        const safeFileName = source.url
          .replace(/https?:\/\//, '')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .substring(0, 50);
        
        const htmlFilePath = path.join(htmlDir, `${safeFileName}.html`);
        fs.writeFileSync(htmlFilePath, html);
        console.log(`Raw HTML saved to: ${htmlFilePath}`);
        
        // Parse with cheerio
        const $ = cheerio.load(html);
        
        // Debug page structure
        console.log('\nPage Structure Analysis:');
        console.log(`Title: ${$('title').text().trim()}`);
        console.log(`Meta Description: ${$('meta[name="description"]').attr('content') || 'None'}`);
        
        // Detect SharePoint elements
        const isSharePoint = $('[data-automation-id="CanvasSection"], .ms-SPCanvas, .ms-publiccanvas').length > 0;
        console.log(`SharePoint Detected: ${isSharePoint ? 'Yes' : 'No'}`);
        
        // List main content containers
        console.log('\nMain Content Containers:');
        ['main', '#main-content', '#content', '.content', 'article', '.article'].forEach(selector => {
          const elements = $(selector);
          if (elements.length > 0) {
            console.log(`${selector}: ${elements.length} elements found, text length: ${elements.text().trim().length}`);
          }
        });
        
        // Look for regulation-related elements
        console.log('\nRegulation-Related Elements:');
        [
          // Common regulation selectors
          'h1:contains("Regulation")', 
          'h2:contains("Regulation")',
          'h3:contains("Regulation")',
          'p:contains("Chapter")',
          'p:contains("Title 22")',
          'p:contains("Pennsylvania Code")',
          'a[href*="pacode"]',
          // SharePoint specific selectors
          '.ms-rtestate-field:contains("Regulation")',
          '[data-automation-id="textBox"]:contains("Regulation")'
        ].forEach(selector => {
          const elements = $(selector);
          if (elements.length > 0) {
            console.log(`${selector}: ${elements.length} elements found`);
            elements.each((i, el) => {
              if (i < 3) { // Limit to first 3 for brevity
                console.log(`  Text sample: ${$(el).text().trim().substring(0, 100)}...`);
              }
            });
          }
        });
        
        // Analyze links
        console.log('\nRegulation-Related Links:');
        const links = $('a[href]').filter((i, el) => {
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
debugPARegulationCollector().catch(console.error);
