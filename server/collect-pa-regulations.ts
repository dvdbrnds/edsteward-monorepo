import { paRegulationCollector } from './services/pa-regulation-collector';
import { regulations } from '@shared/schema';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { syslog, LogLevel, LogFacility } from './services/syslog';

async function collectPARegulations() {
  try {
    console.log('Starting Pennsylvania regulation collection...');

    // Collect regulations from PA sources
    const newRegulations = await paRegulationCollector.collectRegulations();
    console.log(`Found ${newRegulations.length} regulations to process`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const regulation of newRegulations) {
      if (!regulation.name || !regulation.stateAgency) {
        console.warn('Skipping invalid regulation:', regulation);
        skipped++;
        continue;
      }

      try {
        // Use a transaction for each regulation
        await db.transaction(async (tx) => {
          // Print regulation details for debugging
          console.log('\nRegulation details:');
          console.log('Title:', regulation.name);
          console.log('State Agency:', regulation.stateAgency);
          console.log('Content Preview:', regulation.requirements?.substring(0, 200));
          console.log('URL:', regulation.regulationUrl);

          // Check if regulation already exists by name AND state agency
          const existing = await tx.query.regulations.findFirst({
            where: and(
              eq(regulations.name, regulation.name),
              eq(regulations.stateAgency, regulation.stateAgency)
            )
          });

          // Prepare regulation data with required fields
          const regulationData = {
            ...regulation,
            jurisdiction: 'state' as const,
            stateCode: 'PA',
            lastUpdated: new Date(),
            isApplicable: true,
            itemId: existing ? existing.itemId : `PA-${regulation.stateAgency}-${Date.now()}`,
            topic: regulation.topic || 'General',
            statute: regulation.statute || '',
            category: regulation.category || 'Other'
          };

          if (existing) {
            // Only update if content has changed
            if (existing.requirements !== regulationData.requirements) {
              console.log(`Updating existing regulation: ${regulation.name} (${regulation.stateAgency})`);
              await tx
                .update(regulations)
                .set({
                  ...regulationData,
                  versionNumber: existing.versionNumber + 1,
                  previousVersionId: existing.id
                })
                .where(
                  and(
                    eq(regulations.id, existing.id),
                    eq(regulations.stateAgency, regulation.stateAgency)
                  )
                );
              updated++;
              console.log(`Successfully updated regulation: ${regulation.name}`);
            } else {
              console.log(`Skipping update - no content changes: ${regulation.name}`);
              skipped++;
            }
          } else {
            // Insert new regulation
            console.log(`Inserting new regulation: ${regulation.name} (${regulation.stateAgency})`);
            await tx.insert(regulations).values({
              ...regulationData,
              versionNumber: 1
            });
            imported++;
            console.log(`Successfully imported new regulation: ${regulation.name}`);
          }
        });
      } catch (error) {
        console.error(`Error processing regulation ${regulation.name}:`, error);
        skipped++;

        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database operation failed", {
          id: "DB_ERROR",
          parameters: {
            name: regulation.name,
            error: error instanceof Error ? error.message : String(error),
            stackTrace: error instanceof Error ? error.stack : undefined
          }
        });

        // If we get a connection error, wait a bit before continuing
        if (error instanceof Error && error.message.includes('terminating connection')) {
          console.log('Database connection error, waiting before continuing...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    console.log(`\nPA Regulation collection complete.`);
    console.log(`Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`);

  } catch (error) {
    console.error('Error collecting PA regulations:', error);
    throw error;
  }
}

// ES Module compatible entry point check
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  collectPARegulations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { collectPARegulations };