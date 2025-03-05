import { updateRegulationsFromSources } from './regulation-data-collector';
import { storage } from './storage';

/**
 * Updates regulation data from their source agencies
 */
async function main() {
  try {
    console.log('Starting scheduled regulation source update...');
    console.log('Time:', new Date().toISOString());

    // Get regulations that need updating (not updated in the last 7 days)
    const regulations = await storage.getRegulations();
    console.log('Fetching regulations from database...');
    console.log(`Found ${regulations.length} regulations in database:`, regulations);

    const outdatedRegulations = regulations.filter(reg => {
      const lastUpdate = reg.lastUpdated ? new Date(reg.lastUpdated) : new Date(0);
      const daysSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceUpdate >= 7;
    });

    console.log(`Found ${outdatedRegulations.length} regulations that need updating`);

    // For testing, only process the first regulation that has an agency name
    const testRegulation = outdatedRegulations.find(reg => reg.agency_name);
    if (testRegulation) {
      console.log(`Testing with regulation: ${testRegulation.itemId} - ${testRegulation.name}`);
      await updateRegulationsFromSources([testRegulation]);
    } else {
      console.log('No regulations with agency names found for testing');
    }

    console.log('Regulation source update completed successfully');

  } catch (error) {
    console.error('Failed to update regulation sources:', error);
    process.exit(1);
  }
}

// Use ES module syntax for the entry point check
if (import.meta.url === import.meta.resolve('./update-regulation-sources.ts')) {
  main().catch(console.error);
}

export { main as updateRegulationSources };