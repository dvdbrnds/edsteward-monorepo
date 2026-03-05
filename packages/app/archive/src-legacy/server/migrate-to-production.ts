import { db } from "./db";
import { regulations } from "@shared/schema";
import { importToProductionDatabase } from "./services/production-data-manager";
import { syslog, LogLevel, LogFacility } from './services/syslog';

async function migrateToProduction() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('This script must be run in production environment');
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting production migration");
    
    // Get all existing regulation IDs
    const existingRegulations = await db
      .select({ itemId: regulations.itemId })
      .from(regulations);

    const regulationIds = existingRegulations.map(reg => reg.itemId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Found ${regulationIds.length} regulations to migrate`);

    const results = await importToProductionDatabase(regulationIds);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Migration completed", results);
    return results;

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Migration failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Only run if executed directly
if (require.main === module) {
  migrateToProduction()
    .then(results => {
      process.exit(0);
    })
    .catch(error => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateToProduction };
