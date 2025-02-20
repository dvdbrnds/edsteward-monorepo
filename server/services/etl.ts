import { parse } from "csv-parse/sync";
import xlsx from 'xlsx';
import type { InsertRegulation, Regulation } from "@shared/schema";
import { storage } from "../storage";

interface ImportResult {
  newCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
}

export class RegulationETL {
  private validateRecord(record: any): string[] {
    const errors: string[] = [];

    // Only validate essential fields
    if (!record.Topic?.trim()) {
      errors.push('Topic is required');
    }
    if (!record['Item ID']?.trim()) {
      errors.push('Item ID is required');
    }
    if (!record.Statute?.trim()) {
      errors.push('Statute is required');
    }

    return errors;
  }

  private mapToRegulation(record: any): InsertRegulation {
    return {
      itemId: record['Item ID']?.trim() || '',
      topic: record.Topic?.trim() || '',
      statute: record.Statute?.trim() || '',
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
  }

  public async importFromCSV(fileContent: string): Promise<ImportResult> {
    const result: ImportResult = {
      newCount: 0,
      updateCount: 0,
      skipCount: 0,
      errorCount: 0,
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
        const rowNumber = i + 2;

        const validationErrors = this.validateRecord(record);
        if (validationErrors.length > 0) {
          result.errorCount++;
          result.errors.push({
            row: rowNumber,
            error: validationErrors.join('; '),
            data: record
          });
          continue;
        }

        try {
          const regulation = this.mapToRegulation(record);
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
          result.errorCount++;
          result.errors.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : String(error),
            data: record
          });
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to process CSV: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async exportToExcel(regulations: Regulation[]): Promise<Buffer> {
    const worksheet = xlsx.utils.json_to_sheet(regulations);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Regulations');
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

export const etlService = new RegulationETL();