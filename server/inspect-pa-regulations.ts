
// Unified CommonJS/ESM compatible imports
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the storage instance in a way that works in both module systems
const getStorage = async () => {
  try {
    // Try ESM import
    const module = await import('./storage.js');
    return module.storage;
  } catch (err) {
    try {
      // Fall back to CommonJS require
      const storage = require('./storage.js').storage;
      return storage;
    } catch (requireErr) {
      console.error('Failed to import storage module:', requireErr);
      throw new Error('Could not load storage module using ESM or CommonJS');
    }
  }
};

// Helper to get current directory name in ESM
const getDirname = () => {
  try {
    // For ESM
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  } catch (err) {
    // For CommonJS
    return __dirname;
  }
};


const _currentDir = getDirname();

/**
 * This script inspects PA regulations to analyze content issues
 * and logs detailed information to help debug the scraping process.
 */
async function inspectPARegulations() {
  try {
    console.log('==== PA Regulations Inspector ====');

    // Dynamically get storage module
    const storage = await getStorage();
    
    // Get all PA regulations
    const allRegulations = await storage.getRegulations();
    const paRegulations = allRegulations.filter(
      reg => reg.stateCode === 'PA' && reg.jurisdiction === 'state'
    );

    console.log(`Found ${paRegulations.length} PA regulations to analyze`);

    // Create logs directory with robust path handling
    const logsDir = path.join(process.cwd(), 'logs');
    console.log(`Creating logs directory at: ${logsDir}`);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Write log file with regulation content analysis
    const logFilePath = path.join(logsDir, 'pa-regulations-analysis.log');
    let logContent = `PA Regulations Analysis\n`;
    logContent += `=====================\n`;
    logContent += `Total PA Regulations: ${paRegulations.length}\n\n`;

    // Common patterns in the scraped content
    const contentPatterns = [
      'Contact Us',
      'The Pennsylvania Department of Education',
      'PDE oversees',
      'Clearances & Background Checks',
      'State Board of Education',
      'Professional Standards'
    ];

    const patternCounts: Record<string, number> = {};
    contentPatterns.forEach(pattern => {
      patternCounts[pattern] = 0;
    });

    // Group regulations by agency
    const agencyGroups: Record<string, any[]> = {};
    
    paRegulations.forEach(reg => {
      const agency = reg.stateAgency || 'Unknown';
      if (!agencyGroups[agency]) {
        agencyGroups[agency] = [];
      }
      agencyGroups[agency].push(reg);
    });

    // Analyze each regulation
    for (const reg of paRegulations) {
      logContent += `\n-----------------------------------\n`;
      logContent += `Regulation ID: ${reg.id}\n`;
      logContent += `Name: ${reg.name}\n`;
      logContent += `Agency: ${reg.stateAgency}\n`;
      logContent += `URL: ${reg.regulationUrl}\n`;

      // Content analysis
      const contentLength = reg.requirements?.length || 0;
      logContent += `Content Length: ${contentLength} characters\n`;

      if (contentLength > 0) {
        const preview = reg.requirements?.substring(0, 200).replace(/\n/g, ' ') + '...';
        logContent += `Content Preview: ${preview}\n`;

        // Check for common patterns
        contentPatterns.forEach(pattern => {
          if (reg.requirements?.includes(pattern)) {
            patternCounts[pattern]++;
            logContent += `Contains pattern: "${pattern}"\n`;
          }
        });

        // Check for likely navigational content
        const hasNavigationalContent = reg.requirements?.includes('Contact Us') || 
                                       reg.requirements?.includes('About Us') ||
                                       reg.requirements?.includes('Home') ||
                                       reg.requirements?.includes('Search');

        if (hasNavigationalContent) {
          logContent += `WARNING: Likely contains navigational content\n`;
        }

        // Check for regulation-specific content
        const hasRegulationContent = reg.requirements?.includes('shall') || 
                                     reg.requirements?.includes('must') ||
                                     reg.requirements?.includes('required') ||
                                     reg.requirements?.includes('regulations') ||
                                     reg.requirements?.includes('Chapter');

        if (hasRegulationContent) {
          logContent += `INFO: Contains regulation-specific language\n`;
        } else {
          logContent += `WARNING: Missing regulation-specific language\n`;
        }
      } else {
        logContent += `WARNING: Empty content\n`;
      }
    }

    // Add pattern statistics
    logContent += `\n\nContent Pattern Analysis\n`;
    logContent += `======================\n`;

    Object.entries(patternCounts).forEach(([pattern, count]) => {
      const percentage = (count / paRegulations.length) * 100;
      logContent += `"${pattern}": Found in ${count} regulations (${percentage.toFixed(2)}%)\n`;
    });

    // Write to log file
    fs.writeFileSync(logFilePath, logContent);
    console.log(`Analysis log written to: ${logFilePath}`);

    // Provide summary to console
    console.log('\nContent Pattern Summary:');
    Object.entries(patternCounts).forEach(([pattern, count]) => {
      const percentage = (count / paRegulations.length) * 100;
      console.log(`- "${pattern}": ${count} regulations (${percentage.toFixed(2)}%)`);
    });

    console.log('\nInspection complete. Check the log file for detailed analysis.');

    // Export detailed report
    const reportPath = path.join(logsDir, 'pa_regulations_report.json');

    // Create a report with anonymized regulation data
    const report = {
      summary: {
        total: paRegulations.length,
        byAgency: Object.fromEntries(
          Object.entries(agencyGroups).map(([agency, regs]) => [agency, regs.length])
        ),
        contentStats: patternCounts
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
    console.error('Inspection failed:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
  }
}

// Run the inspection function
inspectPARegulations().catch(error => {
  console.error('Top-level error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
