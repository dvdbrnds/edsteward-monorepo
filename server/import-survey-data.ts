import { parse } from 'csv-parse/sync';
import { promises as fs } from 'fs';
import { db } from './db';
import { regulations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import path from 'path';

async function importSurveyData() {
  const csvFilePath = path.join(process.cwd(), 'attached_assets', 'Higher Education Compliance Survey (Responses) - Form Responses 1.csv');

  try {
    // Read the entire file content
    const fileContent = await fs.readFile(csvFilePath, 'utf-8');

    // Parse CSV content
    const records = parse(fileContent, {
      columns: (header: string[]) => {
        const cleanedHeaders = header.map(col => col.trim()).filter(col => col !== '');
        console.log('\nCSV Headers:', cleanedHeaders);
        return cleanedHeaders;
      },
      skip_empty_lines: true,
      from_line: 2,
      relax_column_count: true,
      trim: true
    });

    console.log(`\nProcessing ${records.length} records from uploaded CSV`);
    console.log('\nFirst record sample:', JSON.stringify(records[0], null, 2));

    let newCount = 0;
    let updateCount = 0;
    let skipCount = 0;

    // Get existing regulations to avoid overwriting
    const existingRegulations = await db
      .select()
      .from(regulations);

    const existingStatuteMap = new Map(
      existingRegulations.map(reg => [reg.statute.toLowerCase(), reg])
    );

    for (const record of records) {
      try {
        // Find the statute name field by checking multiple possible headers
        const findField = (prefixes: string[]) => {
          for (const prefix of prefixes) {
            const key = Object.keys(record).find(k => k.toLowerCase().startsWith(prefix.toLowerCase()));
            if (key && record[key]) return record[key];
          }
          return null;
        };

        // Extract statute name using the actual field name or common variations
        const statuteName = findField(['Clery Act', 'Name of law/regulation', 'Please enter the name of the statute']);

        if (!statuteName) {
          console.log('Skipping record: No statute name found');
          skipCount++;
          continue;
        }

        // Map division/category based on the response
        let category = "Other";
        const division = findField(['Please select your division', 'University/Student Life']) || '';
        const area = findField(['Please select the category', 'Campus Police/Crime Reporting']) || '';

        if (area.includes("Academic")) category = "Academic Programs";
        else if (area.includes("Athletics")) category = "Athletics";
        else if (area.includes("Financial") || area.includes("Accounting")) category = "Accounting";
        else if (area.includes("Admission")) category = "Admissions";
        else if (area.includes("Police") || area.includes("Crime") || area.includes("Security")) category = "Campus Police/Crime Reporting";
        else if (division) category = division;

        // Generate a unique itemId if needed
        const itemId = `${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Math.floor(Math.random() * 100000)}`;

        const regulationData = {
          itemId,
          topic: division || area || 'General Compliance',
          division,
          category,
          statute: statuteName,
          statuteUrl: findField(['https://www.ed.gov', 'https://', 'web link']),
          yearOfPassage: findField(['1990', 'Year of passage']),
          yearOfAmendments: findField(['amended', 'amendments']),
          governmentLevel: findField(['Federal', 'level of government']),
          oversightAgency: findField(['Department of Education', 'agency oversees']),
          complianceRequirements: findField(['Moravian University must:', 'must do to comply']),
          communityNotifications: findField(['notify the campus community', 'tell our community']),
          submissionRequirements: findField(['Submit annual', 'must submit']),
          relatedDepartments: (findField(['Office of Student Affairs', 'departments who share']) || '')
            .split(',')
            .map((d: string) => d.trim())
            .filter(Boolean),
          associatedLaws: (findField(['Violence Against Women Act', 'associated laws']) || '')
            .split(',')
            .map((l: string) => l.trim())
            .filter(Boolean),
          noticeUrl: findField(['drive.google.com', 'notice sent']),
          policyUrl: findField(['moravian.edu', 'policy']),
          lastUpdated: new Date(),
          contactEmail: findField(['dillardv@moravian.edu', 'Email Address']),
          department: division,
          complianceStatus: 'Pending Review',
          reviewFrequency: 'Annual',
          nextReviewDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          notes: null
        };

        // Check for existing regulation with the same statute
        const existingRegulation = existingStatuteMap.get(statuteName.toLowerCase());

        if (existingRegulation) {
          // Update existing regulation while preserving important fields
          const updatedData = {
            ...existingRegulation,
            ...regulationData,
            // Preserve existing values if new data is empty
            itemId: existingRegulation.itemId, // Keep original ID
            category: regulationData.category || existingRegulation.category,
            complianceStatus: existingRegulation.complianceStatus || regulationData.complianceStatus,
            reviewFrequency: existingRegulation.reviewFrequency || regulationData.reviewFrequency,
            nextReviewDate: existingRegulation.nextReviewDate || regulationData.nextReviewDate,
          };

          await db
            .update(regulations)
            .set(updatedData)
            .where(eq(regulations.id, existingRegulation.id));
          updateCount++;
          console.log(`Updated regulation: ${statuteName} (${updatedData.category})`);
        } else {
          await db.insert(regulations).values(regulationData);
          newCount++;
          console.log(`Imported new regulation: ${statuteName} (${regulationData.category})`);
        }
      } catch (error) {
        console.error('Failed to process record:', error);
        skipCount++;
      }
    }

    console.log('\nImport Summary:');
    console.log(`New regulations added: ${newCount}`);
    console.log(`Existing regulations updated: ${updateCount}`);
    console.log(`Skipped records: ${skipCount}`);
    console.log('Import completed successfully');
  } catch (error) {
    console.error('Failed to read or parse CSV file:', error);
    throw error;
  }
}

// Run the import
importSurveyData().catch(console.error);