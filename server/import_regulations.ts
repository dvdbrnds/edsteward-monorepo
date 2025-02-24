import { db } from './db';
import { regulations, deadlines } from '@shared/schema';
import { eq } from 'drizzle-orm';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { parse as parseDate, isValid, isFuture } from 'date-fns';

async function parseDeadline(deadlineText: string): Promise<{ dueDate: Date | null; status: string }> {
  if (!deadlineText || deadlineText.toLowerCase() === 'not applicable') {
    return { dueDate: null, status: 'not_applicable' };
  }

  // Common date patterns
  const patterns = [
    // MM/DD/YYYY
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    // MM/DD
    /(\d{1,2}\/\d{1,2})/,
    // Month DD
    /(\w+ \d{1,2}(?:st|nd|rd|th)?)/i,
    // "Last day of" or "End of" month
    /(?:last day of|end of) (\w+)/i,
    // "Due by" followed by date
    /due by[:\s]+(\w+ \d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2}(?:\/\d{4})?)/i
  ];

  for (const pattern of patterns) {
    const match = deadlineText.match(pattern);
    if (match) {
      let dateStr = match[1];
      let dueDate: Date;

      try {
        // If month name format
        if (/[A-Za-z]/.test(dateStr)) {
          // Handle "last day of" or "end of" month
          if (deadlineText.toLowerCase().includes('last day of') || deadlineText.toLowerCase().includes('end of')) {
            const monthName = dateStr;
            const currentYear = new Date().getFullYear();
            // Get the last day of the specified month
            dueDate = new Date(currentYear, new Date(monthName + ' 1').getMonth() + 1, 0);
          } else {
            // Regular date with month name
            dueDate = parseDate(dateStr, 'MMMM d', new Date());
          }
        } else {
          // If MM/DD or MM/DD/YYYY format
          dueDate = dateStr.includes('/') ? 
            (dateStr.length <= 5 ? 
              parseDate(dateStr + '/' + new Date().getFullYear(), 'MM/dd/yyyy', new Date()) :
              parseDate(dateStr, 'MM/dd/yyyy', new Date())
            ) : new Date(dateStr);
        }

        if (!isValid(dueDate)) {
          continue;
        }

        // If the date is in the past, move it to next year
        if (dueDate < new Date()) {
          dueDate.setFullYear(dueDate.getFullYear() + 1);
        }

        return { dueDate, status: 'pending' };
      } catch (err) {
        continue;
      }
    }
  }

  // If no valid date found but text indicates a deadline exists
  if (deadlineText.toLowerCase().includes('deadline') || 
      deadlineText.toLowerCase().includes('due') ||
      deadlineText.toLowerCase().includes('submit')) {
    // Set to end of current year as a fallback
    const endOfYear = new Date(new Date().getFullYear(), 11, 31);
    return { dueDate: endOfYear, status: 'pending' };
  }

  return { dueDate: null, status: 'not_applicable' };
}

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

    // Clear existing regulations and deadlines
    console.log('Clearing existing regulations and deadlines...');
    await db.delete(deadlines);
    await db.delete(regulations);
    console.log('Existing data cleared');

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
          filingDeadlines: null,
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

        // Insert regulation
        const [insertedRegulation] = await db.insert(regulations).values(regulation).returning({ id: regulations.id });

        // Process deadlines
        if (row['Deadlines']) {
          const { dueDate, status } = await parseDeadline(String(row['Deadlines']));
          if (dueDate) {
            await db.insert(deadlines).values({
              regulationId: insertedRegulation.id,
              dueDate: dueDate,
              status: status,
              assignedTo: 1 // Default to first user, should be updated later
            });
          }
        }

        // Process reporting requirements as potential deadlines
        if (row['Reporting Requirements']) {
          const { dueDate, status } = await parseDeadline(String(row['Reporting Requirements']));
          if (dueDate) {
            await db.insert(deadlines).values({
              regulationId: insertedRegulation.id,
              dueDate: dueDate,
              status: status,
              assignedTo: 1 // Default to first user, should be updated later
            });
          }
        }

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