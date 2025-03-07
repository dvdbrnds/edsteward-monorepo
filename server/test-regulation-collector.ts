import { populateRegulationData } from "./services/regulation-data-collector";
import { syslog, LogLevel, LogFacility } from './services/syslog';

async function main() {
  // Test with Clery Act regulation which has well-defined submission requirements
  const testRegulationId = 'CLERY-ACT-2024';

  try {
    // Ensure we have the required API keys
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is required");
      process.exit(1);
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      "Starting test of Clery Act submission requirements collection");

    const result = await populateRegulationData([testRegulationId]);

    console.log("\nRegulation Population Results:");
    console.log(JSON.stringify(result, null, 2));

    if (result.successful > 0) {
      const regulation = result.results.find(r => r.status === 'success');
      if (regulation) {
        console.log("\nSubmission Requirements Details:");
        console.log("- Submission Guidelines:", regulation.data.submissionGuidelines);
        console.log("- Required Forms:", regulation.data.applicableForms);
        console.log("- Filing Deadlines:", regulation.data.filingDeadlines);
        console.log("- Sources:", regulation.data.sources);
      }
    }

  } catch (error) {
    console.error("Error during regulation collection test:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

main().catch(console.error);