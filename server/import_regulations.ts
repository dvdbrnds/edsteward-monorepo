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
    await db.delete(regulations);

    // Insert new regulations
    for (const row of data) {
      try {
        const regulation = {
          item_id: String(row['Item ID'] || row['ID'] || '').trim() || 'REG' + Math.random().toString(36).substring(2, 8),
          name: String(row['Statute Name'] || row['Name'] || row['Title'] || '').trim(),
          topic: String(row['Topic'] || '').trim(),
          statute: String(row['Statute 1'] || row['Statute'] || '').trim(),
          statute_ids: String(row['Statute IDs'] || '').trim(),
          summary: String(row['Statutory Summary'] || row['Summary'] || '').trim(),
          requirements: String(row['Reporting Requirements'] || row['Requirements'] || '').trim(),
          category: String(row['Additional Resources 1'] || row['Category'] || '').trim(),
          jurisdiction: 'federal', // Default to federal
          is_applicable: true,
          origination_date: null, // Will set based on 'Last Updated' if available
          effective_date: null,
          last_updated: row['Last Updated'] ? new Date(row['Last Updated']) : new Date(),
          last_verified: null,
          next_review_date: null,
          filing_deadlines: row['Deadlines'] ? JSON.stringify(row['Deadlines']) : null,
          reporting_frequency: String(row['Reporting Requirements'] || '').trim(),
          agency_url: '',
          agency_name: '',
          agency_contact: '',
          agency_department: '',
          regulation_url: '',
          requirements_url: '',
          submission_guide_url: '',
          forms_url: '',
          submission_guidelines: String(row['Reporting Requirements'] || '').trim(),
          regulation_text: '',
          applicable_forms: null,
          related_regulations: null,
          compliance_notes: '',
          verification_method: ''
        };

        await db.insert(regulations).values(regulation);
        console.log(`Imported regulation: ${regulation.name}`);
      } catch (err) {
        console.error(`Error importing regulation row:`, err);
        console.error('Row data:', row);
      }
    }

    console.log('Import completed successfully');
  } catch (error) {
    console.error('Error importing regulations:', error);
    throw error;
  }
}

importRegulations().catch(console.error);