import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import xlsx from 'xlsx';
import { storage } from "./storage";
import type { InsertRegulation } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { addMonths, format, parse as dateParse } from "date-fns";
import { RegulationValidator } from "./validation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importRegulations(filePath?: string) {
  if (!filePath) {
    filePath = path.join(__dirname, "..", "attached_assets", "compliance-matrix.xlsx");
  }
  console.log("Reading file from:", filePath);

  try {
    let records: any[];

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
        trim: true,
        quote: '"',
        escape: '"',
        relax_column_count: true
      });
    } else {
      throw new Error('Unsupported file type. Please use .xlsx or .csv files.');
    }

    // Filter out empty records and explanatory rows
    records = records.filter(record => {
      const hasContent = Object.values(record).some(value => 
        value && String(value).trim() !== '' && 
        !String(value).startsWith('Example:') &&
        String(value) !== 'Timestamp' &&
        String(value) !== 'Email Address'
      );
      return hasContent;
    });

    console.log(`Found ${records.length} valid records to import`);

    let newCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    let validationErrors = 0;

    const validator = new RegulationValidator();

    for (const record of records) {
      try {
        // Check if this is the compliance survey format
        const isComplianceSurvey = record['Name of law/regulation'] !== undefined;

        // Generate a unique itemId for survey responses
        let itemId = '';
        if (isComplianceSurvey) {
          const timestamp = record['Timestamp'];
          if (timestamp) {
            // Convert timestamp to a format suitable for itemId
            const date = new Date(timestamp);
            itemId = `REG-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${date.getTime().toString().slice(-4)}`;
          }
        } else {
          itemId = record['Item ID'] || record['id'] || '';
        }

        if (!itemId) continue; // Skip records without a valid ID

        // Extract common fields or set defaults based on the file format
        const regulation: InsertRegulation = isComplianceSurvey ? {
          itemId,
          topic: record['Name of law/regulation']?.split('(')[0]?.trim() || 'Unknown',
          statute: record['Provide a web link to the law/regulation'] || "N/A",
          statuteIds: record['Year of passage (original)'] || null,
          summary: record['Briefly describe what Moravian must do to comply with the law.'] || null,
          requirements: [
            record['Briefly describe what we must tell our community to be compliant.'],
            record['Briefly describe what we must submit to the regulatory agency to be compliant.']
          ].filter(Boolean).join('\n\n'),
          deadlines: null,
          category: determineCategoryFromDivision(record['Please select your division of the institution.']),
          regulationUrl: record['Provide a web link to the law/regulation'] || null,
          requirementsUrl: record['Please attach the most recent copy of any notice sent to the community.'] || null,
          lastUpdated: new Date()
        } : {
          itemId: itemId.toString(),
          topic: record['Topic'] || record['name'] || '',
          statute: record['Statute Name'] || record['Statute 1'] || "N/A",
          statuteIds: record['Statute IDs'] || null,
          summary: record['Statutory Summary'] || null,
          requirements: record['description'] || 
                       record['Reporting Requirements'] || 
                       [record['Regulation 1'], record['Regulation 2'], record['Regulation 3'], 
                        record['Regulation 4'], record['Regulation 5']].filter(Boolean).join('\n\n'),
          deadlines: record['Deadlines'] || null,
          category: determineCategory(record['Topic'] || ''),
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
          console.log(`Skipped duplicate regulation: ${record['Item ID'] || record['id'] || record['Timestamp']}`);
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

function determineCategoryFromDivision(division: string): string {
  if (!division) return "Other";

  const divisionMap: Record<string, string> = {
    "Academic Affairs": "Academic Programs",
    "University/Student Life": "Student Life",
    "Administration and Finance": "Administration",
    "Enrollment Management": "Admissions",
    "Athletics": "Athletics"
  };

  return divisionMap[division] || "Other";
}

function determineCategory(topic: string): string {
  if (!topic) return "Other";

  const topicLower = topic.toLowerCase();
  if (topicLower.includes("academic")) return "Academic Programs";
  if (topicLower.includes("athletics")) return "Athletics";
  if (topicLower.includes("financial") || topicLower.includes("accounting")) return "Accounting";
  if (topicLower.includes("admission")) return "Admissions";
  if (topicLower.includes("safety") || topicLower.includes("security")) return "Campus Safety";

  return "Other";
}

if (process.argv[2]) {
  importRegulations(process.argv[2]).catch(console.error);
} else {
  importRegulations().catch(console.error);
}

export { importRegulations };