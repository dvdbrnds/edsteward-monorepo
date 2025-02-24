import { db } from './db';
import { regulations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

async function importRegulations() {
  try {
    console.log('Starting regulations import...');

    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'compliance-matrix.xlsx');
    console.log('Reading file from:', filePath);

    const workbook = xlsx.read(fs.readFileSync(filePath), { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} regulations to import`);

    // Clear existing regulations
    console.log('Clearing existing regulations...');
    await db.delete(regulations);
    console.log('Existing regulations cleared');

    // Insert new regulations
    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      try {
        // Generate a unique itemId based on the Excel Item ID or a random string
        const itemId = row['Item ID'] ? 
          `REG${String(row['Item ID']).padStart(4, '0')}` : 
          `REG${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        console.log(`Processing regulation with Item ID: ${itemId}`);

        const regulation = {
          itemId: itemId,
          name: String(row['Statute Name'] || row['Name'] || '').trim() || 'Untitled Regulation',
          topic: String(row['Topic'] || '').trim(),
          statute: String(row['Statute 1'] || row['Statute'] || '').trim(),
          statuteIds: String(row['Statute IDs'] || '').trim(),
          summary: String(row['Statutory Summary'] || row['Summary'] || '').trim(),
          requirements: String(row['Reporting Requirements'] || '').trim(),
          category: String(row['Additional Resources 1'] || '').trim() || 'Uncategorized',
          jurisdiction: 'federal',
          isApplicable: true,
          originationDate: null,
          effectiveDate: null,
          lastUpdated: row['Last Updated'] ? new Date(row['Last Updated']) : new Date(),
          lastVerified: null,
          nextReviewDate: null,
          filingDeadlines: row['Deadlines'] ? JSON.stringify(row['Deadlines']) : null,
          reportingFrequency: String(row['Reporting Requirements'] || '').trim(),
          agency_url: '',
          agencyName: '',
          agencyContact: '',
          agencyDepartment: '',
          regulationUrl: '',
          requirementsUrl: '',
          submissionGuideUrl: '',
          formsUrl: '',
          submissionGuidelines: String(row['Reporting Requirements'] || '').trim(),
          regulationText: '',
          applicableForms: null,
          relatedRegulations: null,
          complianceNotes: '',
          verificationMethod: ''
        };

        // Verify required fields are present
        if (!regulation.itemId || !regulation.name) {
          throw new Error('Missing required fields: itemId or name');
        }

        await db.insert(regulations).values(regulation);
        console.log(`Successfully imported regulation: ${regulation.name}`);
        successCount++;
      } catch (err) {
        console.error(`Error importing regulation row:`, err);
        console.error('Row data:', JSON.stringify(row, null, 2));
        errorCount++;
      }
    }

    console.log(`Import completed with ${successCount} successes and ${errorCount} errors`);
  } catch (error) {
    console.error('Error importing regulations:', error);
    throw error;
  }
}

importRegulations().catch(console.error);