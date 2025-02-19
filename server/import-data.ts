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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importRegulations() {
  const excelPath = path.join(__dirname, "..", "attached_assets", "compliance-matrix.xlsx");
  console.log("Reading Excel file from:", excelPath);

  try {
    // Read the Excel file
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with raw: false to get string values
    const records = xlsx.utils.sheet_to_json(worksheet, { raw: false });
    console.log(`Found ${records.length} records to import from Excel`);

    let newCount = 0;
    let skipCount = 0;
    let updateCount = 0;

    for (const record of records as any[]) {
      try {
        // Combine multiple statute fields into one
        const statutes = [
          record['Statute 1'],
          record['Statute 2'],
          record['Statute 3'],
          record['Statute 4']
        ].filter(Boolean).join('; ');

        // Combine multiple regulation fields
        const requirements = [
          record['Regulation 1'],
          record['Regulation 2'],
          record['Regulation 3'],
          record['Regulation 4'],
          record['Regulation 5']
        ].filter(Boolean).join('\n\n');

        // Extract category from Topic field or fallback to default categories
        let category = "Other";
        const topic = record['Topic'] || "";
        const itemId = record['Item ID'] || String(record['Topic ID'] || "");

        if (topic.toLowerCase().includes("academic")) category = "Academic Programs";
        else if (topic.toLowerCase().includes("athletics")) category = "Athletics";
        else if (topic.toLowerCase().includes("financial") || topic.toLowerCase().includes("accounting")) category = "Accounting";
        else if (topic.toLowerCase().includes("admission")) category = "Admissions";
        else if (topic.toLowerCase().includes("safety") || topic.toLowerCase().includes("security")) category = "Campus Safety";

        // Parse and process deadlines
        let deadlines = record['Deadlines'] || "";
        if (!deadlines || deadlines === "Not Applicable") {
          // Set a default deadline based on category
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

        // Check if regulation already exists
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
            // Update existing regulation if content has changed
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
          lastUpdated: record['Last Updated'] ? new Date(record['Last Updated']) : new Date()
        };

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
    console.log('Import completed');

  } catch (error) {
    console.error('Failed to read or process Excel file:', error);
    throw error;
  }
}

importRegulations().catch(console.error);