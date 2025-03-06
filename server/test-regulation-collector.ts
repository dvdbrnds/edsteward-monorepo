import { populateRegulationData } from "./services/regulation-data-collector";

async function main() {
  // Test regulation IDs - these would typically come from your source of regulations
  const testRegulationIds = [
    // Department of Labor regulations
    'DOL-2024-001',    // Labor standards regulation
    'DOL-2024-002',    // Workplace safety regulation
    // Other regulations for comparison
    'TITLE-IX-2024',   // Title IX updates
    'CLERY-ACT-2024',  // Clery Act updates
  ];

  try {
    // Ensure we have the required API keys
    if (!process.env.DOL_API_KEY) {
      console.error("DOL API key not found. Please set the DOL_API_KEY environment variable.");
      process.exit(1);
    }

    console.log("Starting test population of regulations...");
    console.log("Test includes both API-sourced and web-scraped regulations");

    await populateRegulationData(testRegulationIds);
    console.log("Completed regulation data population test");

  } catch (error) {
    console.error("Fatal error during regulation population:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

main().catch(console.error);