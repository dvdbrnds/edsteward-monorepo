import { parse } from "csv-parse/sync";
import xlsx from 'xlsx';
import { sql } from "drizzle-orm";
import type {
  InsertRegulation,
  Regulation,
  CsvSchema,
  ValidationRule,
  TransformationLog,
  ErrorRecord,
  InsertTransformationLog,
  InsertErrorRecord,
  CsvSchemaField
} from "@shared/schema";
import { storage } from "../storage";
import { RegulationValidator } from "../validation";
import { addMonths, format } from "date-fns";
import { db } from "../db";
import { transformationLogs, errorRecords } from "@shared/schema";

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

// Schema validation utilities
export class SchemaValidator {
  private validateDataType(value: any, type: string): boolean {
    switch (type) {
      case "string":
        return typeof value === "string" || value === null;
      case "number":
        return !isNaN(Number(value)) || value === null;
      case "boolean":
        return typeof value === "boolean" || ["true", "false", "0", "1"].includes(String(value).toLowerCase()) || value === null;
      case "date":
        return !isNaN(Date.parse(value)) || value === null;
      default:
        console.error(`Unknown type: ${type}`);
        return false;
    }
  }

  public validateField(value: any, field: CsvSchemaField): string | null {
    // Log the validation attempt
    console.log("Validating field:", { value, field });

    if (field.required && (value === undefined || value === null || value === "")) {
      return "Required field is missing";
    }

    if (value !== undefined && value !== null && value !== "") {
      if (!this.validateDataType(value, field.type)) {
        return `Invalid data type. Expected ${field.type}, got ${typeof value}`;
      }
    }

    return null;
  }
}

export class ETLProcessor {
  private schemaValidator: SchemaValidator;

  constructor() {
    this.schemaValidator = new SchemaValidator();
  }

  public async processCSV(
    fileContent: string,
    schema: CsvSchema,
    validationRules: ValidationRule[]
  ): Promise<ImportResult> {
    console.log("Starting CSV processing with schema:", {
      schemaName: schema.name,
      schemaStructure: schema.schema
    });

    if (!fileContent.trim()) {
      throw new Error("CSV file is empty");
    }

    try {
      // Validate CSV structure
      const firstLine = fileContent.split('\n')[0];
      if (!firstLine) {
        throw new Error("CSV header is missing");
      }

    const result: ImportResult = {
      newCount: 0,
      updateCount: 0,
      skipCount: 0,
      errorCount: 0,
      errors: []
    };

    let processedRows = new Set<string>();

    try {
      if (!schema.schema || typeof schema.schema !== "object") {
        throw new Error("Invalid schema structure");
      }

      // Parse CSV with relaxed options
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relaxColumnCount: true,
        relaxQuotes: true
      });

      if (!records.length) {
        throw new Error("No records found in CSV file");
      }

      console.log("First record:", records[0]);

      // Validate headers
      const headers = Object.keys(records[0]);
      const schemaFields = Object.entries(schema.schema) as [string, CsvSchemaField][];

      const requiredFields = schemaFields
        .filter(([_, field]) => field.required)
        .map(([name]) => name);

      const missingFields = requiredFields.filter(field => !headers.includes(field));
      if (missingFields.length > 0) {
        throw new Error(`Missing required columns: ${missingFields.join(", ")}`);
      }

      // Process records
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2; // Account for header row and 0-based index
        const rowKey = JSON.stringify(record); // Create a key for the row

        if (processedRows.has(rowKey)) {
          console.warn(`Skipping duplicate row ${rowNumber}`);
          result.skipCount++;
          continue;
        }
        processedRows.add(rowKey);

        try {
          const validationErrors: string[] = [];

          for (const [fieldName, fieldDef] of schemaFields) {
            const value = record[fieldName];
            const error = this.schemaValidator.validateField(value, fieldDef);
            if (error) {
              validationErrors.push(`${fieldName}: ${error}`);
            }
          }

          if (validationErrors.length > 0) {
            result.errorCount++;
            result.errors.push({
              row: rowNumber,
              error: validationErrors.join("; "),
              data: record
            });
            continue;
          }

          result.newCount++;
        } catch (error) {
          console.error(`Error processing row ${rowNumber}:`, error);
          result.errorCount++;
          result.errors.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : String(error),
            data: record
          });
        }
      }
    } catch (error) {
      console.error("CSV processing failed:", error);
      throw error;
    }
    
    return result;
  }
}

export class RegulationETL {
  private validator: RegulationValidator;
  private etlProcessor: ETLProcessor;

  constructor() {
    this.validator = new RegulationValidator();
    this.etlProcessor = new ETLProcessor();
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

  public async exportToExcel(regulations: Regulation[]): Promise<Buffer> {
    const worksheet = xlsx.utils.json_to_sheet(regulations);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Regulations');
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  public async exportToCSV(regulations: Regulation[]): Promise<string> {
    const header = Object.keys(regulations[0] || {}).join(',') + '\n';
    const rows = regulations.map(reg =>
      Object.values(reg).map(val =>
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    ).join('\n');
    return header + rows;
  }

  public async importFromCSV(fileContent: string, schema: CsvSchema, validationRules: ValidationRule[]): Promise<ImportResult> {
    console.log("Starting CSV import...");
    return this.etlProcessor.processCSV(fileContent, schema, validationRules);
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