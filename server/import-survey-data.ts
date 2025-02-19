import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import { db } from './db';
import { regulations } from '@shared/schema';
import path from 'path';

async function importSurveyData() {
  const csvFilePath = path.join(process.cwd(), 'attached_assets', 'Higher Education Compliance Survey (Responses) - Form Responses 1.csv');
  const records: any[] = [];

  // Parse CSV file
  const parser = createReadStream(csvFilePath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true
    }));

  for await (const record of parser) {
    const regulationData = {
      itemId: record['Timestamp'].replace(/[^0-9]/g, ''), // Use timestamp as itemId
      topic: record['Please select your division of the institution.'],
      division: record['Please select your division of the institution.'],
      category: record['Please select the category that most closely represents your functional area of work.'],
      statute: record['Name of law/regulation, including full name and applicable abbreviation'],
      statuteUrl: record['Provide a web link to the law/regulation (this should be the actual text of the law where it lives on the agency\'s site- not another organization writing about it).'],
      yearOfPassage: record['Year of passage (original)'],
      yearOfAmendments: record['Year(s) of amendments/reauthorization, if applicable'],
      governmentLevel: record['Select level of government responsible for law/regulation.'],
      oversightAgency: record['Which agency oversees compliance with the law/regulation?'],
      complianceRequirements: record['Briefly describe what Moravian must do to comply with the law.'],
      communityNotifications: record['Briefly describe what we must tell our community to be compliant. (Enter what, who, how, how often or N/A)'],
      noticeUrl: record['Please attach the most recent copy of any notice sent to the community.'],
      submissionRequirements: record['Briefly describe what we must submit to the regulatory agency to be compliant. (Enter who, what, how, how often, or N/A)'],
      relatedDepartments: record['Please list other departments who shared responsibility for compliance with this law/regulation.'].split(',').map((d: string) => d.trim()),
      associatedLaws: record['List any associated (or related) laws/regulations, if applicable.'].split(',').map((l: string) => l.trim()),
      policyUrl: record['Provide link to associated institutional policy, if applicable.'],
      contactEmail: record['Email Address'],
      department: record['Please select your division of the institution.'],
      lastUpdated: new Date(),
    };

    records.push(regulationData);
  }

  console.log(`Found ${records.length} records to import`);

  // Import records into database
  let newCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  for (const record of records) {
    try {
      const result = await db.insert(regulations).values(record);
      if (result) {
        newCount++;
      }
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        skipCount++;
        console.log(`Skipped duplicate regulation: ${record.itemId}`);
      } else {
        console.error(`Error importing regulation ${record.itemId}:`, error);
      }
    }
  }

  console.log('\nImport Summary:');
  console.log(`New regulations added: ${newCount}`);
  console.log(`Duplicates skipped: ${skipCount}`);
  console.log('Import completed');
}

// Run the import
importSurveyData().catch(console.error);
