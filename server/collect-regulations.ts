import { populateRegulationData } from "./services/regulation-data-collector";
import readline from 'readline';
import { writeFileSync } from 'fs';
import { db } from "./db";
import { regulations } from "@shared/schema";
import { syslog, LogLevel, LogFacility } from './services/syslog';

const standardRegulations = [
  'TITLE-IX-2024',
  'ADA-2024-001',
  'FERPA-2024-UPDATE',
  'CLERY-ACT-2024',
  'SAFETY-REG-2024'
];

async function main() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting regulation data collection");

    console.log("Starting regulation data collection process...");
    console.log("Using standard regulation set for initial population");

    await populateRegulationData(standardRegulations);

    console.log("Initial regulation data collection completed");
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Initial regulation data collection completed");

  } catch (error) {
    console.error("Error:", error);
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error in regulation collection", {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Unhandled promise rejection", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});

main().catch(console.error);