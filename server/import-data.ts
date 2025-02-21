import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import xlsx from 'xlsx';
import { storage } from "./storage";
import type { InsertRegulation } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { regulations } from "@shared/schema";
import { addMonths, format } from "date-fns";
import { RegulationValidator } from "./validation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importRegulations(filePath?: string) {
  // If no file path provided, use the default Excel file
  if (!filePath) {
    filePath = path.join(__dirname, "..", "attached_assets", "compliance-matrix.xlsx");
  }
  console.log("Reading file from:", filePath);

  try {
    let records: any[];

    // Determine file type and parse accordingly
    if (filePath.endsWith('.xlsx')) {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      records = xlsx.utils.sheet_to_json(worksheet, { raw: false });
    } else if (filePath.endsWith('.csv')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } else {
      throw new Error('Unsupported file type. Please use .xlsx or .csv files.');
    }

    console.log(`Found ${records.length} records to import`);

    let newCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    let validationErrors = 0;

    const validator = new RegulationValidator();

    for (const record of records) {
      try {
        // Extract common fields or set defaults
        const itemId = record['Item ID'] || record['id'] || '';
        const topic = record['Topic'] || record['name'] || '';
        const requirements = record['description'] || 
                           record['Reporting Requirements'] || 
                           [record['Regulation 1'], record['Regulation 2'], record['Regulation 3'], 
                            record['Regulation 4'], record['Regulation 5']].filter(Boolean).join('\n\n');

        let category = "Other";
        if (topic.toLowerCase().includes("academic")) category = "Academic Programs";
        else if (topic.toLowerCase().includes("athletics")) category = "Athletics";
        else if (topic.toLowerCase().includes("financial") || topic.toLowerCase().includes("accounting")) category = "Accounting";
        else if (topic.toLowerCase().includes("admission")) category = "Admissions";
        else if (topic.toLowerCase().includes("safety") || topic.toLowerCase().includes("security")) category = "Campus Safety";

        const regulation: InsertRegulation = {
          itemId: itemId.toString(),
          topic,
          statute: record['Statute Name'] || record['Statute 1'] || "N/A",
          statuteIds: record['Statute IDs'] || null,
          summary: record['Statutory Summary'] || null,
          requirements,
          deadlines: record['Deadlines'] || null,
          category,
          regulationUrl: record['Regulation URL'] || null,
          requirementsUrl: record['Requirements URL'] || null,
          lastUpdated: record['Last Updated'] ? new Date(record['Last Updated']) : new Date()
        };

        // Validate regulation before importing
        const errors = validator.validateRegulation(regulation);
        if (errors.length > 0) {
          console.error(`Validation failed for regulation ${regulation.itemId}:`, errors);
          validationErrors++;
          continue;
        }

        await storage.createRegulation(regulation);
        newCount++;
        console.log(`Imported regulation: ${regulation.itemId} (${regulation.category})`);

      } catch (error: any) {
        if (error?.code === '23505') { // Duplicate key error
          skipCount++;
          console.log(`Skipped duplicate regulation: ${record['Item ID'] || record['id']}`);
        } else {
          console.error(`Failed to import record:`, error);
          console.error('Record data:', JSON.stringify(record, null, 2));
        }
      }
    }

    console.log('\nImport Summary:');
    console.log(`New regulations added: ${newCount}`);
    console.log(`Existing regulations updated: ${updateCount}`);
    console.log(`Duplicates skipped: ${skipCount}`);
    console.log(`Validation errors: ${validationErrors}`);
    console.log('Import completed');

    return { newCount, updateCount, skipCount, validationErrors };

  } catch (error) {
    console.error('Failed to read or process file:', error);
    throw error;
  }
}

if (process.argv[2]) {
  importRegulations(process.argv[2]).catch(console.error);
} else {
  importRegulations().catch(console.error);
}

export { importRegulations };