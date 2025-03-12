import { paRegulationCollector } from './services/pa-regulation-collector';
import { regulations } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';

async function collectPARegulations() {
  try {
    console.log('Starting Pennsylvania regulation collection...');
    
    // Collect regulations from PA sources
    const newRegulations = await paRegulationCollector.collectRegulations();
    
    let imported = 0;
    let updated = 0;
    
    for (const regulation of newRegulations) {
      if (!regulation.name || !regulation.stateCode) {
        console.warn('Skipping invalid regulation:', regulation);
        continue;
      }
      
      // Check if regulation already exists
      const existing = await db.query.regulations.findFirst({
        where: eq(regulations.name, regulation.name)
      });
      
      if (existing) {
        // Update existing regulation
        await db
          .update(regulations)
          .set({
            ...regulation,
            lastUpdated: new Date(),
            versionNumber: existing.versionNumber + 1,
            previousVersionId: existing.id
          })
          .where(eq(regulations.id, existing.id));
        updated++;
      } else {
        // Insert new regulation
        await db.insert(regulations).values({
          ...regulation,
          itemId: `PA-REG-${Date.now()}`,
          lastUpdated: new Date(),
          versionNumber: 1
        });
        imported++;
      }
    }
    
    console.log(`PA Regulation collection complete. Imported: ${imported}, Updated: ${updated}`);
    
  } catch (error) {
    console.error('Error collecting PA regulations:', error);
    throw error;
  }
}

// Only run if called directly
if (require.main === module) {
  collectPARegulations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { collectPARegulations };
