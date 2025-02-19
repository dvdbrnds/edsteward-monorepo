import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import { db } from './db';
import { regulations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import path from 'path';

async function importSurveyData() {
  const csvFilePath = path.join(process.cwd(), 'attached_assets', 'Higher Education Compliance Survey (Responses) - Form Responses 1.csv');
  const records: any[] = [];

  // Parse CSV file
  const parser = createReadStream(csvFilePath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    }));

  for await (const record of parser) {
    // Helper function to safely split array fields
    const safeSplit = (value: string | undefined) => {
      if (!value) return [];
      return value.split(',').map(item => item.trim()).filter(Boolean);
    };

    // Clean and map the data
    const regulationData = {
      itemId: record['Timestamp']?.replace(/[^0-9]/g, '') || '',
      topic: record['Please select your division of the institution.'] || '',
      division: record['Please select your division of the institution.'] || '',
      category: record['Please select the category that most closely represents your functional area of work.'] || '',
      statute: record['Name of law/regulation, including full name and applicable abbreviation\n\nExample: Violence Against Women Act (VAWA)'] || '',
      statuteUrl: record['Provide a web link to the law/regulation (this should be the actual text of the law where it lives on the agency\'s site- not another organization writing about it).\n\nExample: https://www.justice.gov/ovw/legislation'] || '',
      yearOfPassage: record['Year of passage (original)'] || '',
      yearOfAmendments: record['Year(s) of amendments/reauthorization, if applicable'] || '',
      governmentLevel: record['Select level of government responsible for law/regulation.'] || '',
      oversightAgency: record['Which agency oversees compliance with the law/regulation?\n\nExample: Office on Violence Against Women (OVW) in Department of Justice (DOJ)'] || '',
      complianceRequirements: record['Briefly describe what Moravian must do to comply with the law.\n\nExample: Under the Drug-Free Schools and Communities Act (DFSCA), institutions must develop a Comprehensive Drug and Alcohol Abuse Prevention Program (DAAPP). Plan must comply with federal and state laws, must be distributed to students and employees annually, and reviewed biennially.'] || '',
      communityNotifications: record['Briefly describe what we must tell our community to be compliant. (Enter what, who, how, how often or N/A)\n\nExample: The Campus Sex Crimes Prevention Act requires we advise the campus community annually on where to find information concerning registered sex offenders. Communicated via Annual Security Report (October 1st).'] || '',
      noticeUrl: record['Please attach the most recent copy of any notice sent to the community.'] || '',
      submissionRequirements: record['Briefly describe what we must submit to the regulatory agency to be compliant. (Enter who, what, how, how often, or N/A)\n\nExample: The Clery Act requires annual submission of Moravian\'s Annual Security & Fire Safety Report (campus crime statistics) to the U.S. Department of Education\'s Campus Safety and Security Data site each October.'] || '',
      relatedDepartments: safeSplit(record['Please list other departments who shared responsibility for compliance with this law/regulation.\n\nExample: Admission and HR help to prevent sex-discrimination of prospective students and employees under Title IX.']),
      associatedLaws: safeSplit(record['List any associated (or related) laws/regulations, if applicable.\n\nExample: The Drug-Free Workplace Act intersects with the Drug-Free Schools and Communities Act.']),
      policyUrl: record['Provide link to associated institutional policy, if applicable.\n\nExample: PA\'s Child Protective Services Law should link to Moravian\'s Protection of Minors Policy.'] || '',
      contactEmail: record['Email Address'] || '',
      department: record['Please select your division of the institution.'] || '',
      lastUpdated: new Date(),
    };

    // Skip empty records
    if (!regulationData.statute) {
      continue;
    }

    records.push(regulationData);
  }

  console.log(`Found ${records.length} records to process`);

  // Import/Update records in database
  let newCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  for (const record of records) {
    try {
      // Check if regulation already exists
      const existingRegulation = await db.select()
        .from(regulations)
        .where(eq(regulations.statute, record.statute));

      if (existingRegulation.length > 0) {
        // Update existing regulation with new data if available
        const existing = existingRegulation[0];
        const updatedData = {
          ...record,
          // Preserve existing data if new data is empty
          statuteUrl: record.statuteUrl || existing.statuteUrl,
          yearOfPassage: record.yearOfPassage || existing.yearOfPassage,
          yearOfAmendments: record.yearOfAmendments || existing.yearOfAmendments,
          complianceRequirements: record.complianceRequirements || existing.complianceRequirements,
          communityNotifications: record.communityNotifications || existing.communityNotifications,
          submissionRequirements: record.submissionRequirements || existing.submissionRequirements,
          policyUrl: record.policyUrl || existing.policyUrl,
          lastUpdated: new Date(),
        };

        await db.update(regulations)
          .set(updatedData)
          .where(eq(regulations.id, existing.id));

        updateCount++;
        console.log(`Updated regulation: ${record.statute}`);
      } else {
        // Insert new regulation
        const result = await db.insert(regulations).values(record);
        if (result) {
          newCount++;
          console.log(`Imported new regulation: ${record.statute}`);
        }
      }
    } catch (error: any) {
      errorCount++;
      console.error(`Error processing regulation ${record.statute}:`, error.message);
    }
  }

  console.log('\nImport Summary:');
  console.log(`New regulations added: ${newCount}`);
  console.log(`Existing regulations updated: ${updateCount}`);
  console.log(`Failed imports: ${errorCount}`);
  console.log('Import completed');
}

// Run the import
importSurveyData().catch(console.error);