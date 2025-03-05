import { populateRegulationData } from "./services/regulation-data-collector";

async function main() {
  // Test regulation IDs - these would typically come from your source of regulations
  const testRegulationIds = [
    // Valid regulation IDs
    'OSHA-2024-001',  // Workplace safety regulation
    'EDU-2024-001',   // Education regulation
    'FERPA-2024',     // Privacy regulation

    // Invalid/malformed IDs to test error handling
    'INVALID-REG',    // Invalid format
    '',               // Empty string
    'TEST-123'        // Unknown format
  ];

  try {
    // Ensure we have the OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.");
      process.exit(1);
    }

    console.log("Starting test population of regulations...");
    console.log("Test includes both valid and invalid regulation IDs to verify error handling");

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