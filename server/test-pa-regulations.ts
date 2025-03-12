import { paRegulationCollector } from './services/pa-regulation-collector';
import { syslog, LogLevel, LogFacility } from './services/syslog';

async function testPARegulationCollection() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Starting PA regulation collection test');
    
    const regulations = await paRegulationCollector.collectRegulations();
    
    console.log('\nCollection Results:');
    console.log(`Total regulations found: ${regulations.length}`);
    
    // Group by source
    const bySource = regulations.reduce((acc, reg) => {
      const source = reg.stateAgency || 'Unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nRegulations by source:');
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`${source}: ${count}`);
    });
    
    // Validate each regulation
    let validCount = 0;
    for (const regulation of regulations) {
      if (await paRegulationCollector.validateRegulation(regulation)) {
        validCount++;
      }
    }
    
    console.log('\nValidation Results:');
    console.log(`Valid regulations: ${validCount}/${regulations.length}`);
    
    // Display sample regulation
    if (regulations.length > 0) {
      console.log('\nSample Regulation:');
      console.log(JSON.stringify(regulations[0], null, 2));
    }
    
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Test failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    console.error('Test failed:', error);
  }
}

testPARegulationCollection();
