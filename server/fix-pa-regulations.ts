
import { storage } from './storage';
import { db } from './db';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import { regulations } from '@shared/schema';
import { eq, and, isNull, lt } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

/**
 * This script attempts to fix common issues with PA regulations:
 * 1. Empty content
 * 2. HTML tags in content
 * 3. Duplicate regulations
 * 4. Missing metadata
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
    
    // 1. Fix empty content
    const emptyContentRegs = paRegulations.filter(
      reg => !reg.requirements || reg.requirements.length < 100
    );
    
    console.log(`\n1. Found ${emptyContentRegs.length} regulations with empty or very short content`);
    
    let emptyFixed = 0;
    for (const reg of emptyContentRegs.slice(0, 10)) { // Limit to first 10 for testing
      if (reg.regulationUrl) {
        try {
          console.log(`\nAttempting to fix content for: ${reg.name}`);
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
          
          // Try multiple content selectors
          const contentSelectors = [
            '#main-content',
            'main',
            'article',
            '.ms-rtestate-field',
            '[data-automation-id="CanvasZone"]',
            '.content',
            '.main-content'
          ];
          
          let content = '';
          for (const selector of contentSelectors) {
            const element = $(selector).first();
            if (element.length > 0) {
              // Remove script and style tags
              element.find('script, style').remove();
              
              // Get text and trim whitespace
              const text = element.text().trim();
              if (text.length > 100) {
                content = text;
                console.log(`Found content using selector: ${selector}`);
                break;
              }
            }
          }
          
          if (content.length > 100) {
            // Update the regulation
            await db.update(regulations)
              .set({
                requirements: content,
                lastUpdated: new Date()
              })
              .where(eq(regulations.id, reg.id));
            
            console.log(`Updated content for ${reg.name} (${content.length} characters)`);
            emptyFixed++;
          } else {
            console.log(`Could not find suitable content for ${reg.name}`);
          }
        } catch (error) {
          console.error(`Error fixing content for ${reg.name}:`, error);
        }
      }
    }
    
    console.log(`\nFixed ${emptyFixed} regulations with empty content`);
    
    // 2. Fix HTML in content
    const htmlContentRegs = paRegulations.filter(
      reg => reg.requirements && 
             reg.requirements.includes('<') && 
             reg.requirements.includes('>')
    );
    
    console.log(`\n2. Found ${htmlContentRegs.length} regulations with HTML in content`);
    
    let htmlFixed = 0;
    for (const reg of htmlContentRegs.slice(0, 10)) { // Limit to first 10 for testing
      try {
        console.log(`\nCleaning HTML from: ${reg.name}`);
        
        const $ = cheerio.load(`<div>${reg.requirements}</div>`);
        // Remove all scripts and styles
        $('script, style').remove();
        
        // Get text and trim whitespace
        const cleanContent = $('div').text().trim();
        
        if (cleanContent.length > 100) {
          // Update the regulation
          await db.update(regulations)
            .set({
              requirements: cleanContent,
              lastUpdated: new Date()
            })
            .where(eq(regulations.id, reg.id));
          
          console.log(`Cleaned HTML from ${reg.name} (${cleanContent.length} characters)`);
          htmlFixed++;
        }
      } catch (error) {
        console.error(`Error cleaning HTML from ${reg.name}:`, error);
      }
    }
    
    console.log(`\nFixed ${htmlFixed} regulations with HTML in content`);
    
    // 3. Find and mark potential duplicates
    console.log('\n3. Checking for duplicates...');
    
    const nameMap = new Map<string, number[]>();
    
    // Group by similar names
    paRegulations.forEach(reg => {
      // Normalize name by removing common words and punctuation
      const normalizedName = reg.name
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!nameMap.has(normalizedName)) {
        nameMap.set(normalizedName, []);
      }
      
      nameMap.get(normalizedName)?.push(reg.id);
    });
    
    // Find duplicate groups
    const duplicateGroups = Array.from(nameMap.entries())
      .filter(([_, ids]) => ids.length > 1)
      .map(([name, ids]) => ({ name, ids }));
    
    console.log(`Found ${duplicateGroups.length} potential duplicate groups`);
    
    if (duplicateGroups.length > 0) {
      console.log('Duplicate groups (first 5):');
      duplicateGroups.slice(0, 5).forEach((group, i) => {
        console.log(`Group ${i + 1}: ${group.name} (${group.ids.length} duplicates)`);
        
        // Find the regulations in this group
        const groupRegs = paRegulations.filter(reg => group.ids.includes(reg.id));
        
        // Print details
        groupRegs.forEach((reg, j) => {
          console.log(`  ${j+1}. ID: ${reg.id}, Agency: ${reg.stateAgency}, Version: ${reg.versionNumber}`);
        });
      });
    }
    
    console.log('\n==== Fix Script Complete ====');
    console.log(`Summary of fixes:`);
    console.log(`- Empty content fixed: ${emptyFixed}`);
    console.log(`- HTML content fixed: ${htmlFixed}`);
    console.log(`- Potential duplicate groups found: ${duplicateGroups.length}`);
    
  } catch (error) {
    console.error('Fix script failed:', error);
  }
}

// Run the fix function
fixPARegulations().catch(console.error);
