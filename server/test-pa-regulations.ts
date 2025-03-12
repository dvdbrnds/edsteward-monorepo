import { paRegulationCollector } from './services/pa-regulation-collector';
import { syslog, LogLevel, LogFacility } from './services/syslog';

async function testPARegulationCollection() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Starting PA regulation collection test', {
      id: "TEST_START",
      parameters: { timestamp: new Date().toISOString() }
    });

    const regulations = await paRegulationCollector.collectRegulations();

    console.log('\nCollection Results:');
    console.log(`Total regulations found: ${regulations.length}`);

    // Group by source and jurisdiction
    const summary = regulations.reduce((acc, reg) => {
      const source = reg.stateAgency || 'Unknown';
      const jurisdiction = reg.jurisdiction || 'unspecified';
      const key = `${source} (${jurisdiction})`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nRegulations by source and jurisdiction:');
    Object.entries(summary).forEach(([source, count]) => {
      console.log(`${source}: ${count}`);
    });

    // Print detailed info for all regulations
    console.log('\nDetailed Regulation Information:');
    regulations.forEach((reg, index) => {
      console.log(`\nRegulation ${index + 1}:`);
      console.log(JSON.stringify({
        name: reg.name,
        jurisdiction: reg.jurisdiction,
        stateCode: reg.stateCode,
        stateAgency: reg.stateAgency,
        topic: reg.topic,
        category: reg.category,
        summary: reg.summary?.substring(0, 200) + '...'
      }, null, 2));
    });

    // Validate each regulation
    let validCount = 0;
    const validationResults = await Promise.all(
      regulations.map(async regulation => {
        const isValid = await paRegulationCollector.validateRegulation(regulation);
        if (isValid) validCount++;
        return { regulation, isValid };
      })
    );

    console.log('\nValidation Results:');
    console.log(`Valid regulations: ${validCount}/${regulations.length}`);

    // Log any invalid regulations
    const invalidRegulations = validationResults
      .filter(({ isValid }) => !isValid)
      .map(({ regulation }) => ({
        name: regulation.name,
        jurisdiction: regulation.jurisdiction,
        stateCode: regulation.stateCode
      }));

    if (invalidRegulations.length > 0) {
      console.log('\nInvalid Regulations:');
      console.log(JSON.stringify(invalidRegulations, null, 2));
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'PA regulation collection test completed', {
      id: "TEST_COMPLETE",
      parameters: {
        totalFound: regulations.length,
        validCount,
        sourceBreakdown: summary
      }
    });

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Test failed', {
      id: "TEST_ERROR",
      parameters: {
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
    console.error('Test failed:', error);
  }
}

testPARegulationCollection();