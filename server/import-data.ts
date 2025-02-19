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

async function importRegulations() {
  const excelPath = path.join(__dirname, "..", "attached_assets", "compliance-matrix.xlsx");
  console.log("Reading Excel file from:", excelPath);

  try {
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const records = xlsx.utils.sheet_to_json(worksheet, { raw: false });
    console.log(`Found ${records.length} records to import from Excel`);

    let newCount = 0;
    let skipCount = 0;
    let updateCount = 0;
    let validationErrors = 0;

    const validator = new RegulationValidator();

    for (const record of records as any[]) {
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

        let category = "Other";
        const topic = record['Topic'] || "";
        const itemId = record['Item ID'] || String(record['Topic ID'] || "");

        if (topic.toLowerCase().includes("academic")) category = "Academic Programs";
        else if (topic.toLowerCase().includes("athletics")) category = "Athletics";
        else if (topic.toLowerCase().includes("financial") || topic.toLowerCase().includes("accounting")) category = "Accounting";
        else if (topic.toLowerCase().includes("admission")) category = "Admissions";
        else if (topic.toLowerCase().includes("safety") || topic.toLowerCase().includes("security")) category = "Campus Safety";

        let deadlines = record['Deadlines'] || "";
        if (!deadlines || deadlines === "Not Applicable") {
          const defaultMonths = {
            "Academic Programs": 6,
            "Athletics": 3,
            "Accounting": 4,
            "Admissions": 5,
            "Campus Safety": 3,
            "Other": 6
          };
          const futureDate = addMonths(new Date(), defaultMonths[category as keyof typeof defaultMonths]);
          deadlines = format(futureDate, 'yyyy-MM-dd');
        }

        const [existingRegulation] = await db
          .select()
          .from(regulations)
          .where(eq(regulations.itemId, itemId));

        if (existingRegulation) {
          if (
            existingRegulation.topic !== topic ||
            existingRegulation.statute !== record['Statute Name'] ||
            existingRegulation.requirements !== requirements
          ) {
            await db
              .update(regulations)
              .set({
                topic,
                statute: record['Statute Name'] || statutes,
                statuteIds: record['Statute IDs'] || "",
                summary: record['Statutory Summary'] || "",
                requirements: requirements || record['Reporting Requirements'] || "",
                deadlines,
                category,
                regulationUrl: record['Regulation URL'] || null,
                requirementsUrl: record['Requirements URL'] || null,
                lastUpdated: new Date()
              })
              .where(eq(regulations.id, existingRegulation.id));
            updateCount++;
            console.log(`Updated regulation: ${itemId} (${category})`);
          } else {
            skipCount++;
            console.log(`Skipped duplicate regulation: ${itemId}`);
          }
          continue;
        }

        const regulation: InsertRegulation = {
          itemId,
          topic,
          statute: record['Statute Name'] || statutes,
          statuteIds: record['Statute IDs'] || "",
          summary: record['Statutory Summary'] || "",
          requirements: requirements || record['Reporting Requirements'] || "",
          deadlines,
          category,
          regulationUrl: record['Regulation URL'] || null,
          requirementsUrl: record['Requirements URL'] || null,
          lastUpdated: record['Last Updated'] ? new Date(record['Last Updated']) : new Date()
        };

        const errors = validator.validateRegulation(regulation);
        if (errors.length > 0) {
          console.error(`Validation failed for regulation ${itemId}:`, errors);
          validationErrors++;
          continue;
        }

        await storage.createRegulation(regulation);
        newCount++;
        console.log(`Imported new regulation: ${regulation.itemId} (${category})`);
      } catch (error) {
        console.error(`Failed to import record:`, error);
        console.error('Record data:', JSON.stringify(record, null, 2));
      }
    }

    console.log('\nImport Summary:');
    console.log(`New regulations added: ${newCount}`);
    console.log(`Existing regulations updated: ${updateCount}`);
    console.log(`Duplicates skipped: ${skipCount}`);
    console.log(`Validation errors: ${validationErrors}`);
    console.log('Import completed');

  } catch (error) {
    console.error('Failed to read or process Excel file:', error);
    throw error;
  }
}

importRegulations().catch(console.error);