import { paRegulationCollector } from './services/pa-regulation-collector';
import { syslog, LogLevel, LogFacility } from './services/syslog';

async function testPARegulationCollection() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Starting PA regulation collection test', {
      id: "TEST_START",
      parameters: { timestamp: new Date().toISOString() }
    });

    const regulations = await paRegulationCollector.collectRegulations();


    // Group by source and jurisdiction
    const summary = regulations.reduce((acc, reg) => {
      const source = reg.stateAgency || 'Unknown';
      const jurisdiction = reg.jurisdiction || 'unspecified';
      const key = `${source} (${jurisdiction})`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(summary).forEach(([source, count]) => {
    });

    // Print detailed info for all regulations
    regulations.forEach((reg, index) => {
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


    // Log any invalid regulations
    const invalidRegulations = validationResults
      .filter(({ isValid }) => !isValid)
      .map(({ regulation }) => ({
        name: regulation.name,
        jurisdiction: regulation.jurisdiction,
        stateCode: regulation.stateCode
      }));

    if (invalidRegulations.length > 0) {
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