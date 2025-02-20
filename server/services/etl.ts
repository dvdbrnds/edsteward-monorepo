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
  InsertErrorRecord
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

export class SchemaValidator {
  private validateDataType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return !isNaN(Number(value));
      case 'boolean':
        return typeof value === 'boolean' || ['true', 'false', '0', '1'].includes(String(value).toLowerCase());
      case 'date':
        return !isNaN(Date.parse(value));
      default:
        return true;
    }
  }

  public validateField(value: any, field: { type: string; required: boolean; format?: string }): string | null {
    if (field.required && (value === undefined || value === null || value === '')) {
      return `Required field is missing`;
    }

    if (value !== undefined && value !== null && value !== '') {
      if (!this.validateDataType(value, field.type)) {
        return `Invalid data type. Expected ${field.type}`;
      }

      if (field.format) {
        try {
          const regex = new RegExp(field.format);
          if (!regex.test(String(value))) {
            return `Value does not match required format`;
          }
        } catch (error) {
          console.error('Invalid format regex:', error);
        }
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

  private async startTransformationLog(
    schemaId: number,
    fileName: string
  ): Promise<TransformationLog> {
    const log: InsertTransformationLog = {
      schemaId,
      fileName,
      status: "success",
      recordsProcessed: 0,
      recordsFailed: 0,
      startTime: new Date(),
      metadata: {}
    };

    const [result] = await db.insert(transformationLogs).values(log).returning();
    return result;
  }

  private async logError(
    transformationLogId: number,
    rowNumber: number,
    rawData: any,
    errorType: "validation" | "transformation" | "schema_mismatch",
    errorMessage: string
  ): Promise<void> {
    const error: InsertErrorRecord = {
      transformationLogId,
      rowNumber,
      rawData,
      errorType,
      errorMessage
    };

    await db.insert(errorRecords).values(error);
  }

  private async updateTransformationLog(
    logId: number,
    updates: Partial<TransformationLog>
  ): Promise<void> {
    await db
      .update(transformationLogs)
      .set(updates)
      .where(sql`id = ${logId}`);
  }

  public async processCSV(
    fileContent: string,
    schema: CsvSchema,
    validationRules: ValidationRule[]
  ): Promise<ImportResult> {
    const transformationLog = await this.startTransformationLog(
      schema.id,
      "input.csv"
    );

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
        const rowNumber = i + 2; // Adding 2 to account for header row and 0-based index

        // Validate against schema
        const validationErrors: string[] = [];
        for (const [field, definition] of Object.entries(schema.schema)) {
          const value = record[field];
          const error = this.schemaValidator.validateField(value, definition as any);
          if (error) {
            validationErrors.push(`Field '${field}': ${error}`);
          }
        }

        // Apply custom validation rules
        for (const rule of validationRules) {
          if (!rule.enabled) continue;

          const value = record[rule.fieldName];
          const ruleConfig = rule.ruleConfig as any;

          switch (rule.ruleType) {
            case 'regex':
              if (ruleConfig.pattern && !new RegExp(ruleConfig.pattern).test(String(value))) {
                validationErrors.push(`Field '${rule.fieldName}' does not match pattern ${ruleConfig.pattern}`);
              }
              break;
            case 'range':
              const numValue = Number(value);
              if (!isNaN(numValue)) {
                if (ruleConfig.min !== undefined && numValue < ruleConfig.min) {
                  validationErrors.push(`Field '${rule.fieldName}' is below minimum value ${ruleConfig.min}`);
                }
                if (ruleConfig.max !== undefined && numValue > ruleConfig.max) {
                  validationErrors.push(`Field '${rule.fieldName}' exceeds maximum value ${ruleConfig.max}`);
                }
              }
              break;
            case 'enum':
              if (ruleConfig.values && !ruleConfig.values.includes(value)) {
                validationErrors.push(`Field '${rule.fieldName}' must be one of: ${ruleConfig.values.join(', ')}`);
              }
              break;
          }
        }

        if (validationErrors.length > 0) {
          result.errorCount++;
          result.errors.push({
            row: rowNumber,
            error: validationErrors.join('; '),
            data: record
          });

          await this.logError(
            transformationLog.id,
            rowNumber,
            record,
            "validation",
            validationErrors.join('; ')
          );

          continue;
        }

        // Process valid record
        result.newCount++;
      }

      await this.updateTransformationLog(transformationLog.id, {
        status: result.errorCount > 0 ? "partial" : "success",
        recordsProcessed: records.length,
        recordsFailed: result.errorCount,
        endTime: new Date()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.updateTransformationLog(transformationLog.id, {
        status: "failed",
        recordsFailed: result.errorCount,
        endTime: new Date(),
        metadata: { error: errorMessage }
      });

      throw new Error(`Failed to process CSV: ${errorMessage}`);
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