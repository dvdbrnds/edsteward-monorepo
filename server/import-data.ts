import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import xlsx from 'xlsx';
import { storage } from "./storage";
import type { InsertRegulation, Regulation } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { addMonths, format, parse as dateParse } from "date-fns";
import { RegulationValidator } from "./validation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSV field constants
const COMPLIANCE_SURVEY_FIELDS = {
  LAW_NAME: 'Name of law/regulation, including full name and applicable abbreviation\n\nExample: Violence Against Women Act (VAWA)',
  LAW_LINK: 'Provide a web link to the law/regulation (this should be the actual text of the law where it lives on the agency\'s site- not another organization writing about it).\n\nExample: https://www.justice.gov/ovw/legislation',
  DESCRIPTION: 'Briefly describe what Moravian must do to comply with the law.\n\nExample: Under the Drug-Free Schools and Communities Act (DFSCA), institutions must develop a Comprehensive Drug and Alcohol Abuse Prevention Program (DAAPP). Plan must comply with federal and state laws, must be distributed to students and employees annually, and reviewed biennially.',
  REQUIREMENTS: 'Briefly describe what we must tell our community to be compliant. (Enter what, who, how, how often or N/A)\n\nExample: The Campus Sex Crimes Prevention Act requires we advise the campus community annually on where to find information concerning registered sex offenders. Communicated via Annual Security Report (October 1st).',
  PROOF: 'Please attach the most recent copy of any notice sent to the community.',
  SUBMISSION: 'Briefly describe what we must submit to the regulatory agency to be compliant. (Enter who, what, how, how often, or N/A)\n\nExample: The Clery Act requires annual submission of Moravian\'s Annual Security & Fire Safety Report (campus crime statistics) to the U.S. Department of Education\'s Campus Safety and Security Data site each October.'
};

function normalizeTopic(topic: string): string {
  console.log("Raw topic:", topic);
  const normalized = topic
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // Remove content in parentheses
    .replace(/act|law|regulation|disclosure|requirements?/gi, '')  // Remove common suffixes and variations
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\b(the|and|or|of|for|to|in|on|at|by|with)\b/g, '') // Remove common stop words
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();

  // Handle common abbreviations and variations
  const commonAbbreviations: Record<string, string> = {
    'clery': 'jeanne clery',
    'vawa': 'violence against women',
    'ferpa': 'family educational rights privacy',
    'ada': 'americans disabilities',
    'title ix': 'title nine',
    'campus safety': 'clery',
    'campus security': 'clery',
    'crime statistics': 'clery',
    'annual security report': 'clery'
  };

  let normalizedText = normalized;
  Object.entries(commonAbbreviations).forEach(([abbr, full]) => {
    const pattern = new RegExp(`\\b${abbr}\\b`, 'gi');
    normalizedText = normalizedText.replace(pattern, full);
  });

  console.log("Normalized topic:", normalizedText);
  return normalizedText;
}

function areSimilarTopics(topic1: string, topic2: string): boolean {
  console.log(`\nComparing topics:\n- "${topic1}"\n- "${topic2}"`);
  const normalized1 = normalizeTopic(topic1);
  const normalized2 = normalizeTopic(topic2);

  console.log(`Normalized comparison:\n- "${normalized1}"\n- "${normalized2}"`);

  // Check for exact match after normalization
  if (normalized1 === normalized2) {
    console.log("✓ Found exact match after normalization");
    return true;
  }

  // Check if one is contained within the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    console.log("✓ Found partial match through inclusion");
    return true;
  }

  // Split into words and find common words
  const words1 = normalized1.split(/\s+/);
  const words2 = normalized2.split(/\s+/);
  const commonWords = words1.filter(word => words2.includes(word));

  // Calculate Jaccard similarity
  const uniqueWords = new Set([...words1, ...words2]);
  const similarity = commonWords.length / uniqueWords.size;

  console.log(`Similarity score: ${similarity}`);
  console.log(`Common words: ${commonWords.join(', ')}`);

  // Check for key phrases that indicate same topic
  const keyPhrases = [
    'clery', 'campus safety', 'security report', 'crime statistics',
    'title ix', 'vawa', 'ferpa', 'ada'
  ];
  const hasCommonKeyPhrase = keyPhrases.some(phrase =>
    normalized1.includes(phrase) && normalized2.includes(phrase)
  );

  if (hasCommonKeyPhrase) {
    console.log("✓ Found match through key phrase");
    return true;
  }

  // Check content similarity in summary and requirements
  if (similarity > 0.4) {  // Lowered threshold due to improved normalization
    console.log("✓ Found match through similarity score");
    return true;
  }

  console.log("✗ No match found");
  return false;
}

async function findExistingRegulation(topic: string): Promise<Regulation | undefined> {
  const existingRegulations = await storage.getRegulations();
  console.log(`\nSearching for matches among ${existingRegulations.length} existing regulations`);
  console.log(`Looking for matches for topic: "${topic}"`);

  for (const reg of existingRegulations) {
    console.log(`\nChecking against existing regulation: ${reg.topic}`);
    if (areSimilarTopics(reg.topic, topic)) {
      console.log(`✓ Found matching regulation: "${reg.topic}" matches "${topic}"`);
      return reg;
    }
  }
  console.log("✗ No matching regulation found");
  return undefined;
}

async function mergeRegulations(existing: Regulation, newData: InsertRegulation): Promise<Partial<InsertRegulation>> {
  console.log("\nMerging regulations:");
  console.log("Existing regulation:", {
    topic: existing.topic,
    summary: existing.summary?.substring(0, 100) + "...",
    requirements: existing.requirements?.substring(0, 100) + "..."
  });
  console.log("New regulation:", {
    topic: newData.topic,
    summary: newData.summary?.substring(0, 100) + "...",
    requirements: newData.requirements?.substring(0, 100) + "..."
  });

  const merged = {
    ...existing,
    // Keep the most detailed summary
    summary: existing.summary && newData.summary
      ? `${existing.summary}\n\nAdditional Information:\n${newData.summary}`
      : existing.summary || newData.summary,

    // Combine requirements if they're different
    requirements: existing.requirements && newData.requirements
      ? `${existing.requirements}\n\nAdditional Requirements:\n${newData.requirements}`
      : existing.requirements || newData.requirements,

    // Keep the most recent last updated date
    lastUpdated: new Date(Math.max(
      existing.lastUpdated ? new Date(existing.lastUpdated).getTime() : 0,
      newData.lastUpdated ? new Date(newData.lastUpdated).getTime() : 0
    )),

    // Keep existing IDs and references
    statuteIds: existing.statuteIds || newData.statuteIds,
    statute: existing.statute || newData.statute,
    category: existing.category || newData.category,

    // Merge URLs, keeping the non-null values
    regulationUrl: newData.regulationUrl || existing.regulationUrl,
    requirementsUrl: newData.requirementsUrl || existing.requirementsUrl,
    agency_url: existing.agency_url || null,
  };

  console.log("Merged result:", {
    topic: merged.topic,
    summary: merged.summary?.substring(0, 100) + "..."
  });

  return merged;
}

function determineCategoryFromDivision(division: string): string {
  if (!division) return "Other";

  const divisionMap: Record<string, string> = {
    "Academic Affairs": "Academic Programs",
    "University/Student Life": "Student Life",
    "Administration and Finance": "Administration",
    "Enrollment Management": "Admissions",
    "Athletics": "Athletics"
  };

  return divisionMap[division] || "Other";
}

function determineCategory(topic: string): string {
  if (!topic) return "Other";

  const topicLower = topic.toLowerCase();
  if (topicLower.includes("academic")) return "Academic Programs";
  if (topicLower.includes("athletics")) return "Athletics";
  if (topicLower.includes("financial") || topicLower.includes("accounting")) return "Accounting";
  if (topicLower.includes("admission")) return "Admissions";
  if (topicLower.includes("safety") || topicLower.includes("security")) return "Campus Safety";

  return "Other";
}

async function importRegulations(filePath?: string) {
  if (!filePath) {
    filePath = path.join(__dirname, "..", "attached_assets", "compliance-matrix.xlsx");
  }
  console.log("Reading file from:", filePath);

  try {
    let records: any[];

    if (filePath.endsWith('.xlsx')) {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      records = xlsx.utils.sheet_to_json(worksheet, { raw: false });
    } else if (filePath.endsWith('.csv')) {
      console.log("Processing CSV file...");
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log("CSV content sample:", content.substring(0, 500));
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        quote: '"',
        escape: '"',
        relax_column_count: true
      });
      console.log("Parsed records sample:", records.slice(0, 2));
    } else {
      throw new Error('Unsupported file type. Please use .xlsx or .csv files.');
    }

    // Filter out empty records and explanatory rows
    records = records.filter(record => {
      const hasContent = Object.values(record).some(value =>
        value && String(value).trim() !== '' &&
        !String(value).startsWith('Example:') &&
        String(value) !== 'Timestamp' &&
        String(value) !== 'Email Address'
      );
      return hasContent;
    });

    console.log(`Found ${records.length} valid records to import`);
    console.log("First record sample:", JSON.stringify(records[0], null, 2));

    let newCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    let validationErrors = 0;
    let mergeCount = 0;

    const validator = new RegulationValidator();

    for (const record of records) {
      try {
        // Check if this is the compliance survey format by looking for the specific field
        const isComplianceSurvey = record[COMPLIANCE_SURVEY_FIELDS.LAW_NAME] !== undefined;

        console.log("\nProcessing record:", {
          format: isComplianceSurvey ? 'compliance survey' : 'standard',
          lawName: isComplianceSurvey ? record[COMPLIANCE_SURVEY_FIELDS.LAW_NAME] : record['Topic'],
          timestamp: record['Timestamp']
        });

        // Generate a unique itemId
        const timestamp = record['Timestamp'];
        const itemId = timestamp ?
          `REG-${timestamp.replace(/\D/g, '').substring(0, 12)}` :
          record['Item ID'] || record['id'] || '';

        if (!itemId) {
          console.log("Skipping record - no item ID generated");
          skipCount++;
          continue;
        }

        // Extract fields based on format
        const regulation: InsertRegulation = isComplianceSurvey ? {
          itemId,
          name: record[COMPLIANCE_SURVEY_FIELDS.LAW_NAME] || 'Unknown',
          topic: record[COMPLIANCE_SURVEY_FIELDS.LAW_NAME]?.split('(')[0]?.trim() || 'Unknown',
          statute: record[COMPLIANCE_SURVEY_FIELDS.LAW_LINK] || "N/A",
          statuteIds: record['Year of passage (original)'] || null,
          summary: record[COMPLIANCE_SURVEY_FIELDS.DESCRIPTION] || null,
          requirements: [
            record[COMPLIANCE_SURVEY_FIELDS.REQUIREMENTS],
            record[COMPLIANCE_SURVEY_FIELDS.SUBMISSION]
          ].filter(Boolean).join('\n\n'),
          deadlines: null,
          category: determineCategoryFromDivision(record['Please select your division of the institution.']),
          regulationUrl: record[COMPLIANCE_SURVEY_FIELDS.LAW_LINK] || null,
          requirementsUrl: record[COMPLIANCE_SURVEY_FIELDS.PROOF] || null,
          lastUpdated: new Date(),
          agency_url: null
        } : {
          itemId: itemId.toString(),
          name: record['Statute Name'] || record['name'] || record['Topic'] || '',
          topic: record['Topic'] || record['name'] || '',
          statute: record['Statute Name'] || record['Statute 1'] || "N/A",
          statuteIds: record['Statute IDs'] || null,
          summary: record['Statutory Summary'] || null,
          requirements: record['description'] ||
            record['Reporting Requirements'] ||
            [record['Regulation 1'], record['Regulation 2'], record['Regulation 3'],
            record['Regulation 4'], record['Regulation 5']].filter(Boolean).join('\n\n'),
          deadlines: record['Deadlines'] || null,
          category: determineCategory(record['Topic'] || ''),
          regulationUrl: record['Regulation URL'] || null,
          requirementsUrl: record['Requirements URL'] || null,
          lastUpdated: record['Last Updated'] ? new Date(record['Last Updated']) : new Date(),
          agency_url: null
        };

        console.log(`\nProcessing regulation: ${regulation.topic}`);

        // Check for existing similar regulation
        const existingRegulation = await findExistingRegulation(regulation.topic);

        if (existingRegulation) {
          console.log(`\nExisting regulation found:`, existingRegulation);
          // Merge the regulations
          const mergedRegulation = await mergeRegulations(existingRegulation, regulation);
          console.log(`\nMerged regulation:`, mergedRegulation);

          // Validate merged regulation
          const errors = validator.validateRegulation(mergedRegulation as Regulation);
          if (errors.length > 0) {
            console.error(`Validation failed for merged regulation ${regulation.itemId}:`, errors);
            validationErrors++;
            continue;
          }

          // Update the existing regulation with merged data
          await storage.updateRegulation(existingRegulation.id, mergedRegulation);
          mergeCount++;
          console.log(`✓ Merged regulation: ${regulation.topic} into ${existingRegulation.topic}`);
          continue;
        }

        // Validate regulation before importing
        const errors = validator.validateRegulation(regulation as Regulation);
        if (errors.length > 0) {
          console.error(`Validation failed for regulation ${regulation.itemId}:`, errors);
          validationErrors++;
          continue;
        }

        await storage.createRegulation(regulation);
        newCount++;
        console.log(`✓ Imported regulation: ${regulation.itemId} (${regulation.category})`);

      } catch (error: any) {
        if (error?.code === '23505') { // Duplicate key error
          skipCount++;
          console.log(`Skipped duplicate regulation: ${record['Item ID'] || record['id'] || record['Timestamp']}`);
        } else {
          console.error(`Failed to import record:`, error);
          console.error('Record data:', JSON.stringify(record, null, 2));
        }
      }
    }

    console.log('\nImport Summary:');
    console.log(`New regulations added: ${newCount}`);
    console.log(`Existing regulations merged: ${mergeCount}`);
    console.log(`Duplicates skipped: ${skipCount}`);
    console.log(`Validation errors: ${validationErrors}`);
    console.log('Import completed');

    return { newCount, updateCount, skipCount, validationErrors, mergeCount };

  } catch (error) {
    console.error('Failed to read or process file:', error);
    throw error;
  }
}

if (process.argv[2]) {
  importRegulations(process.argv[2]).catch(console.error);
} else {
  importRegulations().catch(console.error);
}

export { importRegulations };