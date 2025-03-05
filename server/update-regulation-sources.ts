import { updateRegulationsFromSources } from './regulation-data-collector';

async function main() {
  try {
    console.log('Starting scheduled regulation source update...');
    console.log('Time:', new Date().toISOString());
    
    await updateRegulationsFromSources();
    
    console.log('Regulation source update completed successfully');
    
  } catch (error) {
    console.error('Failed to update regulation sources:', error);
    process.exit(1);
  }
}

// Run the updater
if (require.main === module) {
  main().catch(console.error);
}

export { main as updateRegulationSources };
