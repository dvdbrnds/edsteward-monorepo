import { db } from "../db";
import { regulations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { syslog, LogLevel, LogFacility } from './syslog';
import { populateRegulationData } from "./regulation-data-collector";

export async function importToProductionDatabase(regulationIds: string[]) {
  try {
    // Environment check
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('This script must be run in production environment');
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Starting production data import for ${regulationIds.length} regulations`);

    const results = {
      total: regulationIds.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      updated: 0
    };

    for (const regulationId of regulationIds) {
      try {
        // Check if regulation already exists
        const existing = await db.select()
          .from(regulations)
          .where(eq(regulations.itemId, regulationId));

        if (existing.length > 0) {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
            `Regulation ${regulationId} already exists, skipping`);
          results.skipped++;
          continue;
        }

        // Gather and validate data
        const data = await populateRegulationData([regulationId]);
        if (!data || data.failed > 0) {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
            `Failed to gather data for regulation ${regulationId}`);
          results.failed++;
          continue;
        }

        results.processed++;
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Successfully processed regulation ${regulationId}`);

      } catch (error) {
        results.failed++;
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
          `Error processing regulation ${regulationId}`, {
            error: error instanceof Error ? error.message : String(error)
          });
      }
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Production import completed", results);
    return results;

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Production import failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
