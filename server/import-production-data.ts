import { populateRegulationData } from "./services/regulation-data-collector";
import { storage } from "./storage";
import { db } from "./db";
import { regulations } from "@shared/schema";
import { syslog, LogLevel, LogFacility } from './services/syslog';

async function importProductionData() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting production data import");
    
    // First verify database connection
    const testQuery = await db.select().from(regulations).limit(1);
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Database connection verified");

    // Get all regulation IDs
    const allRegulations = await db.select({ itemId: regulations.itemId }).from(regulations);
    const regulationIds = allRegulations.map(reg => reg.itemId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${regulationIds.length} regulations to import`);

    // Import regulations using our existing service
    const result = await populateRegulationData(regulationIds);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Import completed", {
      totalProcessed: result.totalProcessed,
      successful: result.successful,
      failed: result.failed
    });

    return result;
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Import failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Only run if executed directly
if (require.main === module) {
  importProductionData()
    .then((result) => {
      console.log("Import completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Import failed:", error);
      process.exit(1);
    });
}

export { importProductionData };
