import { parse } from "csv-parse/sync";
import type { InsertRegulation } from "@shared/schema";
import { storage } from "../storage";

interface ImportResult {
  newCount: number;
  updateCount: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

export async function importRegulationsFromCSV(fileContent: string): Promise<ImportResult> {
  const result: ImportResult = {
    newCount: 0,
    updateCount: 0,
    errors: []
  };

  try {
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // Account for header row and 0-based index

      // Validate required fields
      if (!record.Topic?.trim()) {
        result.errors.push({ row: rowNumber, error: "Topic is required" });
        continue;
      }
      if (!record['Item ID']?.trim()) {
        result.errors.push({ row: rowNumber, error: "Item ID is required" });
        continue;
      }
      if (!record.Statute?.trim()) {
        result.errors.push({ row: rowNumber, error: "Statute is required" });
        continue;
      }

      try {
        const regulation: InsertRegulation = {
          itemId: record['Item ID'].trim(),
          topic: record.Topic.trim(),
          statute: record.Statute.trim(),
          requirements: record.Requirements?.trim() || '',
          category: record.Category?.trim() || 'Other',
          deadlines: record.Deadlines?.trim() || '',
          lastUpdated: new Date(),
          agency_url: record['Agency URL']?.trim() || null,
          regulationUrl: null,
          requirementsUrl: null,
          statuteIds: null,
          summary: null
        };

        // Check if regulation already exists
        const existingRegulations = await storage.getRegulations();
        const existing = existingRegulations.find(r => r.itemId === regulation.itemId);

        if (existing) {
          await storage.updateRegulation(existing.id, regulation);
          result.updateCount++;
        } else {
          await storage.createRegulation(regulation);
          result.newCount++;
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to process CSV: ${error instanceof Error ? error.message : String(error)}`);
  }
}