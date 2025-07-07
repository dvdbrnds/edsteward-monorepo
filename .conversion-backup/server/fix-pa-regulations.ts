
import { storage } from './storage';
import { db } from './db';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import { regulations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

/**
 * This script attempts to fix common issues with PA regulations:
 * 1. Empty content
 * 2. HTML tags in content
 * 3. Navigation and boilerplate content
 * 4. Missing or incorrect regulation content
 */
async function fixPARegulations() {
  try {
    console.log('==== PA Regulations Fixer ====');
    
    // Get all PA regulations
    const allRegulations = await storage.getRegulations();
    const paRegulations = allRegulations.filter(
      reg => reg.stateCode === 'PA' && reg.jurisdiction === 'state'
    );
    
    console.log(`Found ${paRegulations.length} PA regulations to analyze`);
    
    // Fixing regulations with navigation/boilerplate content
    console.log('\nFixing regulations with navigation/boilerplate content...');
    
    let boilerplateFixed = 0;
    const boilerplatePatterns = [
      'The Pennsylvania Department of Education (PDE) oversees',
      'Contact Us Form',
      'PDE Press Office',
      'State Library of Pennsylvania',
      'Professional Standards and Practices Commission'
    ];
    
    for (const reg of paRegulations) {
      let hasBoilerplate = false;
      for (const pattern of boilerplatePatterns) {
        if (reg.requirements?.includes(pattern)) {
          hasBoilerplate = true;
          break;
        }
      }
      
      if (hasBoilerplate && reg.regulationUrl) {
        try {
          console.log(`\nFetching content for: ${reg.name}`);
          console.log(`URL: ${reg.regulationUrl}`);
          
          const response = await fetch(reg.regulationUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          if (!response.ok) {
            console.log(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            continue;
          }
          
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // Remove navigation, header, footer elements
          $('nav, header, footer, .header, .footer, .navigation, .menu, .sidebar, .meta, script, style').remove();
          
          // Enhanced content selectors for PA education pages
          const contentSelectors = [
            // Content-specific selectors
            '.regulation-content', 
            '.code-content',
            '.chapter-content',
            '.rules-content',
            '.policy-content',
            // PA SharePoint selectors
            '[data-automation-id="CanvasZone"]',
            '.ms-rtestate-field',
            // Generic content selectors
            'article',
            '.main-content',
            '#main-content',
            'main',
            '.content',
            '#content'
          ];
          
          // Focus on elements likely to contain regulations
          const regulationSelectors = [
            'p:contains("Chapter")',
            'p:contains("Section")',
            'p:contains("§")',
            'p:contains("shall")',
            'p:contains("must")',
            'div:contains("§")',
            'div:contains("Chapter")'
          ];
          
          // First try regulation-specific content
          let extractedContent = '';
          
          // Look for regulation-specific elements
          for (const selector of regulationSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
              console.log(`Found ${elements.length} regulation elements with selector: ${selector}`);
              
              elements.each((_, el) => {
                // Get parent container for context
                const parentContent = $(el).parent().text().trim();
                if (parentContent.length > 100) {
                  extractedContent += parentContent + '\n\n';
                } else {
                  extractedContent += $(el).text().trim() + '\n\n';
                }
              });
            }
          }
          
          // If no regulation-specific content found, try general content containers
          if (extractedContent.length < 100) {
            for (const selector of contentSelectors) {
              const element = $(selector).first();
              if (element.length > 0) {
                // Remove navigation elements that might be inside content
                element.find('nav, .navigation, .menu, script, style').remove();
                
                // Get text content
                const text = element.text().trim();
                if (text.length > 100) {
                  console.log(`Found content using selector: ${selector}`);
                  
                  // Skip if content contains known boilerplate text
                  const isBoilerplate = boilerplatePatterns.some(pattern => text.includes(pattern));
                  if (!isBoilerplate) {
                    extractedContent = text;
                    break;
                  } else {
                    console.log(`Skipping boilerplate content from selector: ${selector}`);
                  }
                }
              }
            }
          }
          
          // Clean up the extracted content
          extractedContent = extractedContent
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          
          // Check if the content is substantially different and useful
          if (extractedContent.length > 100 && 
              !boilerplatePatterns.some(pattern => extractedContent.includes(pattern))) {
            
            // Update the regulation
            await db.update(regulations)
              .set({
                requirements: extractedContent,
                lastUpdated: new Date()
              })
              .where(eq(regulations.id, reg.id));
            
            console.log(`Updated content for ${reg.name} (${extractedContent.length} characters)`);
            boilerplateFixed++;
          } else {
            console.log(`Could not find suitable content for ${reg.name}`);
          }
        } catch (error) {
          console.error(`Error fixing content for ${reg.name}:`, error);
        }
      }
    }
    
    console.log(`\nFixed ${boilerplateFixed} regulations with boilerplate content`);
    
    // Add some fallback summary info if no content could be extracted
    console.log('\nChecking for regulations that need a fallback summary...');
    
    let fallbackAdded = 0;
    for (const reg of paRegulations) {
      if (!reg.requirements || reg.requirements.length < 100) {
        const fallbackSummary = `This is a Pennsylvania state education regulation under the authority of ${reg.stateAgency}. ` +
                               `For specific requirements and details, please refer to the official source at ${reg.regulationUrl}.`;
        
        try {
          await db.update(regulations)
            .set({
              requirements: fallbackSummary,
              lastUpdated: new Date()
            })
            .where(eq(regulations.id, reg.id));
          
          console.log(`Added fallback summary for ${reg.name}`);
          fallbackAdded++;
        } catch (error) {
          console.error(`Error adding fallback for ${reg.name}:`, error);
        }
      }
    }
    
    console.log(`\nAdded fallback summaries for ${fallbackAdded} regulations`);
    console.log('\n==== Fix Script Complete ====');
    
  } catch (error) {
    console.error('Fix script failed:', error);
  }
}

// Run the fix function
fixPARegulations().catch(console.error);
