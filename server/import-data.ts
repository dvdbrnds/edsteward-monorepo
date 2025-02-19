import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { storage } from "./storage";
import type { InsertRegulation } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { regulations } from "@shared/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importRegulations() {
  const csvPath = path.join(__dirname, "..", "attached_assets", "compliance-matrix.csv");
  console.log("Reading CSV file from:", csvPath);

  const fileContent = fs.readFileSync(csvPath, "utf-8");
  console.log("File content loaded successfully");

  // Skip the first row and use the second row as headers
  const records = parse(fileContent, {
    columns: (header: string[]) => {
      return header.map(col => col.trim()).filter(col => col !== '');
    },
    skip_empty_lines: true,
    from_line: 2, // Start from the second line which contains our actual headers
    relax_column_count: true, // Allow rows to have more columns than headers
    trim: true // Trim whitespace from values
  });

  console.log(`Found ${records.length} records to import`);

  let newCount = 0;
  let skipCount = 0;
  let updateCount = 0;

  for (const record of records) {
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

      // Extract category from Topic field or fallback to default categories based on content
      let category = "Other";
      const topic = record['Topic'] || "";
      const itemId = record['Item ID'] || String(record['Topic ID'] || "");

      if (topic.includes("Academic")) category = "Academic Programs";
      else if (topic.includes("Athletics")) category = "Athletics";
      else if (topic.includes("Financial") || topic.includes("Accounting")) category = "Accounting";
      else if (topic.includes("Admission")) category = "Admissions";
      else if (topic.includes("Safety") || topic.includes("Security")) category = "Campus Safety";

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
              deadlines: record['Deadlines'] || "",
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
        deadlines: record['Deadlines'] || "",
        category,
        lastUpdated: record['Last Updated'] ? new Date(record['Last Updated']) : new Date()
      };

      await storage.createRegulation(regulation);
      newCount++;
      console.log(`Imported new regulation: ${regulation.itemId} (${category})`);
    } catch (error) {
      console.error(`Failed to import record:`, error);
      console.error('Record data:', record);
    }
  }

  console.log('\nImport Summary:');
  console.log(`New regulations added: ${newCount}`);
  console.log(`Existing regulations updated: ${updateCount}`);
  console.log(`Duplicates skipped: ${skipCount}`);
  console.log('Import completed');
}

importRegulations().catch(console.error);