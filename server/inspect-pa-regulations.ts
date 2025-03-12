
import { storage } from './storage';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import * as fs from 'fs';
import * as path from 'path';

/**
 * This script inspects the PA regulations in the database
 * to help diagnose collection issues
 */
async function inspectPARegulations() {
  try {
    console.log('==== PA Regulations Inspection ====');
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }
    
    // Get all regulations
    const allRegulations = await storage.getRegulations();
    
    // Filter for PA regulations
    const paRegulations = allRegulations.filter(
      reg => reg.stateCode === 'PA' && reg.jurisdiction === 'state'
    );
    
    console.log(`\nFound ${paRegulations.length} PA regulations out of ${allRegulations.length} total regulations`);
    
    // Group by agency
    const agencyGroups = paRegulations.reduce((acc, reg) => {
      const agency = reg.stateAgency || 'Unknown';
      if (!acc[agency]) {
        acc[agency] = [];
      }
      acc[agency].push(reg);
      return acc;
    }, {} as Record<string, typeof paRegulations>);
    
    console.log('\nPA Regulations by Agency:');
    Object.entries(agencyGroups).forEach(([agency, regs]) => {
      console.log(`${agency}: ${regs.length} regulations`);
    });
    
    // Check content quality
    console.log('\nContent Quality Analysis:');
    
    const contentStats = {
      empty: 0,
      veryShort: 0,
      short: 0,
      medium: 0,
      long: 0,
      veryLong: 0,
      withUrls: 0,
      withHtml: 0
    };
    
    paRegulations.forEach(reg => {
      const content = reg.requirements || '';
      const length = content.length;
      
      if (length === 0) {
        contentStats.empty++;
      } else if (length < 100) {
        contentStats.veryShort++;
      } else if (length < 500) {
        contentStats.short++;
      } else if (length < 2000) {
        contentStats.medium++;
      } else if (length < 5000) {
        contentStats.long++;
      } else {
        contentStats.veryLong++;
      }
      
      if (content.includes('http://') || content.includes('https://')) {
        contentStats.withUrls++;
      }
      
      if (content.includes('<') && content.includes('>')) {
        contentStats.withHtml++;
      }
    });
    
    console.log('Content Length Distribution:');
    console.log(`  Empty: ${contentStats.empty}`);
    console.log(`  Very Short (<100 chars): ${contentStats.veryShort}`);
    console.log(`  Short (100-500 chars): ${contentStats.short}`);
    console.log(`  Medium (500-2000 chars): ${contentStats.medium}`);
    console.log(`  Long (2000-5000 chars): ${contentStats.long}`);
    console.log(`  Very Long (>5000 chars): ${contentStats.veryLong}`);
    console.log(`  With URLs: ${contentStats.withUrls}`);
    console.log(`  With HTML: ${contentStats.withHtml}`);
    
    // Export detailed report
    const reportPath = path.join(logsDir, 'pa_regulations_report.json');
    
    // Create a report with anonymized regulation data
    const report = {
      summary: {
        total: paRegulations.length,
        byAgency: Object.fromEntries(
          Object.entries(agencyGroups).map(([agency, regs]) => [agency, regs.length])
        ),
        contentStats
      },
      regulationSamples: paRegulations.slice(0, 10).map(reg => ({
        name: reg.name,
        agency: reg.stateAgency,
        contentLength: (reg.requirements || '').length,
        contentPreview: (reg.requirements || '').substring(0, 200) + '...',
        url: reg.regulationUrl,
        itemId: reg.itemId,
        topic: reg.topic,
        category: reg.category
      })),
      emptyContentSamples: paRegulations
        .filter(reg => !reg.requirements || reg.requirements.length < 50)
        .slice(0, 10)
        .map(reg => ({
          name: reg.name,
          agency: reg.stateAgency,
          contentLength: (reg.requirements || '').length,
          contentPreview: reg.requirements || '[EMPTY]',
          url: reg.regulationUrl,
          itemId: reg.itemId
        }))
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);
    
    // Print a few examples of problematic regulations
    console.log('\nExamples of Empty/Poor Content Regulations:');
    paRegulations
      .filter(reg => !reg.requirements || reg.requirements.length < 100)
      .slice(0, 5)
      .forEach((reg, i) => {
        console.log(`\nExample ${i + 1}:`);
        console.log(`Name: ${reg.name}`);
        console.log(`Agency: ${reg.stateAgency}`);
        console.log(`URL: ${reg.regulationUrl}`);
        console.log(`Content: ${reg.requirements || '[EMPTY]'}`);
      });
    
    console.log('\n==== Inspection Complete ====');
    
  } catch (error) {
    console.error('Inspection failed:', error);
  }
}

// Run the inspection function
inspectPARegulations().catch(console.error);
