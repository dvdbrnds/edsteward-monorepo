import { db } from './db';
import { regulations, deadlines } from '@shared/schema';
import { eq } from 'drizzle-orm';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { parse as parseDate, isValid, isFuture } from 'date-fns';

// Map topics to main categories
const topicToCategory: Record<string, string> = {
  // Academic Programs
  'Academic Programs': 'Academic Programs',
  'Admissions': 'Academic Programs',
  'Program Integrity Rules': 'Academic Programs',
  'Accreditation': 'Academic Programs',
  'Athletics': 'Academic Programs',
  'Academic Programs,Financial Aid': 'Academic Programs',
  'HEA Compliance Obligations': 'Academic Programs',
  'Title IV Programs': 'Academic Programs',
  'Student Services': 'Academic Programs',
  'Education Records': 'Academic Programs',
  'Education': 'Academic Programs',
  'Student Privacy': 'Academic Programs',
  'Student Life': 'Academic Programs',
  'Program Requirements': 'Academic Programs',
  'Academic Standards': 'Academic Programs',
  'Academic Integrity': 'Academic Programs',
  'Student Records': 'Academic Programs',
  'Privacy / Student Records': 'Academic Programs',
  'Education Administration': 'Academic Programs',
  'Educational Programs': 'Academic Programs',
  'Higher Education': 'Academic Programs',
  'Higher Education Act': 'Academic Programs',
  'Title IV': 'Academic Programs',
  'Title IX': 'Academic Programs',
  'Program Administration': 'Academic Programs',

  // Finance
  'Financial Aid': 'Finance',
  'Tax': 'Finance',
  'Accounting': 'Finance',
  'Contracts & Procurement': 'Finance',
  'Fundraising & Development': 'Finance',
  'Auxiliary Services': 'Finance',
  'Banking': 'Finance',
  'Charitable Giving': 'Finance',
  'Investment': 'Finance',
  'Financial Management': 'Finance',
  'Insurance': 'Finance',
  'Purchasing': 'Finance',
  'Wages': 'Finance',

  // Human Resources
  'Human Resources': 'Human Resources',
  'Employee Benefits': 'Human Resources',
  'Recruitment Hiring & Termination': 'Human Resources',
  'Retirement': 'Human Resources',
  'Unions': 'Human Resources',
  'Health Care and Insurance': 'Human Resources',
  'Discrimination': 'Human Resources',
  'Discrimination,Human Resources': 'Human Resources',
  'Diversity/Affirmative Action': 'Human Resources',
  'Ethics': 'Human Resources',
  'Immigration': 'Human Resources',
  'Immigration,Recruitment Hiring & Termination': 'Human Resources',
  'Disabilities': 'Human Resources',
  'Employment': 'Human Resources',
  'Labor Relations': 'Human Resources',

  // Information Technology
  'Information Technology': 'Information Technology',
  'Privacy & Information Security': 'Information Technology',
  'Copyright & Trademark': 'Information Technology',
  'Telecommunications': 'Information Technology',
  'Data Protection': 'Information Technology',
  'Information Security': 'Information Technology',
  'Technology': 'Information Technology',

  // Research
  'Research': 'Research',
  'Export Controls': 'Research',
  'Intellectual Property and Technology Transfer': 'Research',
  'Grants Management': 'Research',
  'Research Compliance': 'Research',
  'Laboratory Safety': 'Research',
  'Research Ethics': 'Research',
  'Research Administration': 'Research',

  // Campus Safety
  'Campus Safety': 'Campus Safety',
  'Environmental Health and Safety': 'Campus Safety',
  'Sexual Misconduct': 'Campus Safety',
  'Public Safety': 'Campus Safety',
  'Emergency Management': 'Campus Safety',
  'Safety & Security': 'Campus Safety',
  'Health & Safety': 'Campus Safety',
  'Emergency Response': 'Campus Safety',

  // Default to Other
  'International Activities and Programs': 'Other',
  'Governance': 'Other',
  'Housing': 'Other',
  'Lobbying and Political Activities': 'Other',
  'General Administration': 'Other',
  'Institutional': 'Other'
};

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

    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'compliance-matrix.xlsx');

    const workbook = xlsx.read(fs.readFileSync(filePath), { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet);


    // Clear existing regulations and deadlines
    await db.delete(deadlines);
    await db.delete(regulations);

    // Insert new regulations
    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      try {
        // Generate a unique itemId based on the Excel Item ID or a random string
        const itemId = row['Item ID'] ? 
          `REG${String(row['Item ID']).padStart(4, '0')}` : 
          `REG${Math.random().toString(36).substring(2, 8).toUpperCase()}`;


        // Get topic and map to category, with special handling for education-related topics
        let topic = String(row['Topic'] || '').trim();
        let category = topicToCategory[topic] || 'Other';

        // Check if the name contains education-related terms and override category if needed
        const name = String(row['Statute Name'] || row['Name'] || '').trim();
        if (name.toLowerCase().includes('higher education act') || 
            name.toLowerCase().includes('education amendment') ||
            name.toLowerCase().includes('academic program')) {
          category = 'Academic Programs';
        }

        const regulation = {
          itemId: itemId,
          name: name || 'Untitled Regulation',
          topic: topic,
          statute: String(row['Statute 1'] || row['Statute'] || '').trim(),
          statuteIds: String(row['Statute IDs'] || '').trim(),
          summary: String(row['Statutory Summary'] || row['Summary'] || '').trim(),
          requirements: String(row['Reporting Requirements'] || '').trim(),
          category: category,
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

        successCount++;
      } catch (err) {
        console.error(`Error importing regulation row:`, err);
        console.error('Row data:', JSON.stringify(row, null, 2));
        errorCount++;
      }
    }

  } catch (error) {
    console.error('Error importing regulations:', error);
    throw error;
  }
}

importRegulations().catch(console.error);