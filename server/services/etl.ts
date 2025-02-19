import { parse } from "csv-parse/sync";
import xlsx from 'xlsx';
import type { InsertRegulation } from "@shared/schema";
import { storage } from "../storage";
import { RegulationValidator } from "../validation";
import { addMonths, format } from "date-fns";

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
  private validator: RegulationValidator;

  constructor() {
    this.validator = new RegulationValidator();
  }

  private determineCategory(topic: string): string {
    const categoryMap: Record<string, string[]> = {
      "Academic Programs": ["academic", "curriculum", "faculty", "education"],
      "Athletics": ["athletic", "sport", "NCAA", "competition"],
      "Accounting": ["financial", "accounting", "budget", "fiscal", "audit"],
      "Admissions": ["admission", "enrollment", "recruit", "student"],
      "Campus Safety": ["safety", "security", "emergency", "health"]
    };

    const lowerTopic = topic.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => lowerTopic.includes(keyword))) {
        return category;
      }
    }
    return "Other";
  }

  private generateDefaultDeadline(category: string): string {
    const defaultMonths: Record<string, number> = {
      "Academic Programs": 6,
      "Athletics": 3,
      "Accounting": 4,
      "Admissions": 5,
      "Campus Safety": 3,
      "Other": 6
    };
    const futureDate = addMonths(new Date(), defaultMonths[category]);
    return format(futureDate, 'yyyy-MM-dd');
  }

  private async processRecord(record: any, rowIndex: number): Promise<{ regulation: InsertRegulation | null, error?: string }> {
    try {
      const statutes = [
        record['Statute 1'],
        record['Statute 2'],
        record['Statute 3'],
        record['Statute 4']
      ].filter(Boolean).join('; ');

      const requirements = [
        record['Regulation 1'],
        record['Regulation 2'],
        record['Regulation 3'],
        record['Regulation 4'],
        record['Regulation 5']
      ].filter(Boolean).join('\n\n');

      const topic = record['Topic']?.trim() || "";
      const itemId = record['Item ID']?.trim() || String(record['Topic ID'] || "").trim();

      if (!itemId) {
        return { regulation: null, error: 'Missing Item ID' };
      }

      if (!topic) {
        return { regulation: null, error: 'Missing Topic' };
      }

      const category = this.determineCategory(topic);
      let deadlines = record['Deadlines']?.trim() || "";
      
      if (!deadlines || deadlines === "Not Applicable") {
        deadlines = this.generateDefaultDeadline(category);
      }

      const regulation: InsertRegulation = {
        itemId,
        topic,
        statute: record['Statute Name']?.trim() || statutes,
        statuteIds: record['Statute IDs']?.trim() || "",
        summary: record['Statutory Summary']?.trim() || "",
        requirements: requirements || record['Reporting Requirements']?.trim() || "",
        deadlines,
        category,
        lastUpdated: record['Last Updated'] ? new Date(record['Last Updated']) : new Date(),
        agency_url: record['Agency URL']?.trim() || null
      };

      const validationErrors = this.validator.validateRegulation(regulation as any);
      if (validationErrors.length > 0) {
        return { 
          regulation: null, 
          error: `Validation errors: ${validationErrors.map(e => e.error).join(', ')}`
        };
      }

      return { regulation };
    } catch (error) {
      return { 
        regulation: null, 
        error: `Processing error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  public async importFromCSV(fileContent: string): Promise<ImportResult> {
    console.log("Starting CSV import process...");
    const result: ImportResult = {
      newCount: 0,
      updateCount: 0,
      skipCount: 0,
      errorCount: 0,
      errors: []
    };

    try {
      const records = parse(fileContent, {
        columns: (header: string[]) => header.map(col => col.trim()).filter(Boolean),
        skip_empty_lines: true,
        from_line: 2,
        relax_column_count: true,
        trim: true
      });

      console.log(`Processing ${records.length} records from CSV`);
      await this.processRecords(records, result);

    } catch (error) {
      console.error('CSV parsing failed:', error);
      throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  public async importFromExcel(workbook: xlsx.WorkBook): Promise<ImportResult> {
    console.log("Starting Excel import process...");
    const result: ImportResult = {
      newCount: 0,
      updateCount: 0,
      skipCount: 0,
      errorCount: 0,
      errors: []
    };

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const records = xlsx.utils.sheet_to_json(worksheet, { raw: false });
    
    console.log(`Processing ${records.length} records from Excel`);
    await this.processRecords(records, result);

    return result;
  }

  private async processRecords(records: any[], result: ImportResult) {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const { regulation, error } = await this.processRecord(record, i + 2);

      if (error) {
        result.errorCount++;
        result.errors.push({ row: i + 2, error, data: record });
        console.error(`Row ${i + 2} failed:`, error);
        continue;
      }

      if (!regulation) continue;

      try {
        const existingRegulations = await storage.getRegulations();
        const existing = existingRegulations.find(r => r.itemId === regulation.itemId);

        if (existing) {
          if (
            existing.topic !== regulation.topic ||
            existing.statute !== regulation.statute ||
            existing.requirements !== regulation.requirements ||
            existing.agency_url !== regulation.agency_url
          ) {
            await storage.updateRegulation(existing.id, regulation);
            result.updateCount++;
            console.log(`Updated regulation: ${regulation.itemId} (${regulation.category})`);
          } else {
            result.skipCount++;
            console.log(`Skipped unchanged regulation: ${regulation.itemId}`);
          }
        } else {
          await storage.createRegulation(regulation);
          result.newCount++;
          console.log(`Imported new regulation: ${regulation.itemId} (${regulation.category})`);
        }
      } catch (error) {
        result.errorCount++;
        result.errors.push({
          row: i + 2,
          error: `Database operation failed: ${error instanceof Error ? error.message : String(error)}`,
          data: record
        });
        console.error(`Database operation failed for row ${i + 2}:`, error);
      }
    }
  }
}
