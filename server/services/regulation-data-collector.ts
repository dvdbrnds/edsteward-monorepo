import { db } from "../db";
import { regulations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { syslog, LogLevel, LogFacility } from './syslog';
import OpenAI from "openai";
import type { InsertRegulation } from "@shared/schema";
import { storage } from "../storage";
import { scrapeAgencyWebsite, findRegulationPages } from './web-scraper';

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

const AGENCY_BASE_URLS = {
  'ED': 'https://www2.ed.gov',
  'DOL': 'https://www.dol.gov',
  'OSHA': 'https://www.osha.gov',
};

async function verifyOpenAIConnection() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Checking OpenAI API status...");

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "test" }],
      max_tokens: 5,
      temperature: 0
    });

    if (!response.choices[0].message.content) {
      throw new Error("Empty response from OpenAI");
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "OpenAI API connection successful", {
      id: "OPENAI_STATUS",
      parameters: {
        status: "ok",
        message: "API key is valid and working properly"
      }
    });
    return true;
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "OpenAI API connection failed", {
      id: "OPENAI_ERROR",
      parameters: {
        error: error instanceof OpenAI.APIError ? 
          { status: error.status, code: error.code, type: error.type, message: error.message } :
          { message: error instanceof Error ? error.message : String(error) }
      }
    });
    return false;
  }
}

interface RegulationResponse {
  name: string;
  topic: string;
  statute: string;
  summary: string;
  requirements: string;
  category: string;
  jurisdiction: string;
  agency_url: string;
  agency_name: string;
  agency_department: string;
  submission_guidelines: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function validateRegulationResponse(data: any): Promise<RegulationResponse> {
  const requiredFields = [
    'name', 'topic', 'statute', 'summary', 'requirements',
    'category', 'jurisdiction', 'agency_url', 'agency_name',
    'agency_department', 'submission_guidelines'
  ];

  const missingFields = requiredFields.filter(field => !data[field]);
  if (missingFields.length > 0) {
    throw new Error(`Invalid regulation data. Missing fields: ${missingFields.join(', ')}`);
  }

  if (!['federal', 'state'].includes(data.jurisdiction.toLowerCase())) {
    throw new Error(`Invalid jurisdiction: ${data.jurisdiction}. Must be 'federal' or 'state'`);
  }

  return data as RegulationResponse;
}

async function gatherRegulationData(regulationId: string): Promise<RegulationResponse | null> {
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
        `Attempt ${attempts + 1}/${MAX_RETRIES} to gather data for regulation ${regulationId}`);

      // First, try to find and scrape relevant pages
      const searchTerm = regulationId.replace(/-/g, ' ');
      let scrapedContent = '';

      // Search across multiple agency websites
      for (const [agency, baseUrl] of Object.entries(AGENCY_BASE_URLS)) {
        const relevantPages = await findRegulationPages(baseUrl, searchTerm);
        for (const pageUrl of relevantPages.slice(0, 3)) { // Limit to top 3 most relevant pages
          try {
            const { content } = await scrapeAgencyWebsite(pageUrl);
            scrapedContent += `\nContent from ${pageUrl}:\n${content}`;
          } catch (error) {
            syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
              `Failed to scrape page ${pageUrl}`, {
                id: "SCRAPE_WARNING",
                parameters: {
                  url: pageUrl,
                  error: error instanceof Error ? error.message : String(error)
                }
              });
          }
        }
      }

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert in higher education compliance regulations. Analyze the provided website content and regulation ID to extract accurate compliance information. Return the information as a JSON object with these exact fields:

{
  "name": "Official regulation title",
  "topic": "Main subject area",
  "statute": "Legal citation",
  "summary": "Brief description of regulation's purpose",
  "requirements": "Specific compliance requirements",
  "category": "One of: Academic Programs, Campus Safety, Civil Rights, Student Services, Administrative",
  "jurisdiction": "federal or state",
  "agency_url": "Official agency URL",
  "agency_name": "Agency name",
  "agency_department": "Department name",
  "submission_guidelines": "Reporting requirements"
}`
          },
          {
            role: "user",
            content: `Analyze regulation ID ${regulationId} using this scraped content from agency websites:\n\n${scrapedContent}\n\nExtract and structure the regulation information as a JSON object following the specified format.`
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      if (!response.choices[0].message.content) {
        throw new Error("Empty response from OpenAI");
      }

      const content = response.choices[0].message.content.trim();
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
        `Received OpenAI response for regulation ${regulationId}`, {
          id: "OPENAI_RESPONSE",
          parameters: {
            content_preview: content.substring(0, 100) + "...",
            length: content.length
          }
        });

      let regulationData: any;
      try {
        regulationData = JSON.parse(content);
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Successfully parsed JSON response for regulation ${regulationId}`);
      } catch (parseError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
          `Failed to parse JSON response for regulation ${regulationId}`, {
            id: "JSON_PARSE_ERROR",
            parameters: {
              error: parseError instanceof Error ? parseError.message : String(parseError),
              content: content
            }
          });
        throw parseError;
      }

      const validatedData = await validateRegulationResponse(regulationData);
      return validatedData;

    } catch (error) {
      attempts++;

      if (error instanceof OpenAI.APIError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          `OpenAI API error for regulation ${regulationId}`, {
            id: "OPENAI_API_ERROR",
            parameters: {
              status: error.status,
              code: error.code,
              type: error.type,
              message: error.message,
              attempt: attempts,
              regulationId
            }
          });
      } else {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          `Error gathering data for regulation ${regulationId}`, {
            id: "REGULATION_ERROR",
            parameters: {
              error: error instanceof Error ? error.message : String(error),
              attempt: attempts,
              regulationId
            }
          });
      }

      if (attempts === MAX_RETRIES) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          `Failed to gather data for regulation ${regulationId} after ${MAX_RETRIES} attempts`);
        return null;
      }

      await delay(RETRY_DELAY * Math.pow(2, attempts - 1));
    }
  }

  return null;
}

async function enrichRegulationData(regulation: RegulationResponse): Promise<InsertRegulation> {
  const enrichedData: InsertRegulation = {
    ...regulation,
    itemId: `REG-${Date.now()}`,
    isApplicable: true,
    lastUpdated: new Date(),
    effectiveDate: null,
    originationDate: null,
    lastVerified: new Date(),
    nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    filingDeadlines: null,
    reportingFrequency: '',
    regulationUrl: '',
    requirementsUrl: '',
    submissionGuideUrl: '',
    formsUrl: '',
    regulationText: '',
    applicableforms: null,
    relatedRegulations: null,
    complianceNotes: '',
    verificationMethod: '',
    notificationSchedule: null,
    agency_contact: '',
    statuteIds: ''
  };

  return enrichedData;
}

export async function populateRegulationData(regulationIds: string[]): Promise<any> {
  // First verify OpenAI API connection
  const apiStatus = await verifyOpenAIConnection();
  if (!apiStatus) {
    throw new Error("Cannot proceed with regulation data population due to OpenAI API issues");
  }

  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
    `Starting regulation data population for ${regulationIds.length} regulations`);

  let successCount = 0;
  let failureCount = 0;
  let skipCount = 0;
  let results = [];

  for (const regulationId of regulationIds) {
    try {
      // Check if regulation already exists
      const existing = await db.select()
        .from(regulations)
        .where(eq(regulations.itemId, regulationId));

      if (existing.length > 0) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Regulation ${regulationId} already exists, skipping`);
        skipCount++;
        results.push({
          regulationId,
          status: 'skipped',
          reason: 'Already exists'
        });
        continue;
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
        `Gathering data for regulation ${regulationId}`);
      const regulationData = await gatherRegulationData(regulationId);

      if (!regulationData) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          `Failed to gather data for regulation ${regulationId}`);
        failureCount++;
        results.push({
          regulationId,
          status: 'failed',
          error: 'Failed to gather regulation data'
        });
        continue;
      }

      const enrichedData = await enrichRegulationData(regulationData);
      const newRegulation = await storage.createRegulation(enrichedData);
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Successfully created regulation ${regulationId}`);

      successCount++;
      results.push({
        regulationId,
        status: 'success',
        data: {
          id: newRegulation.id,
          name: newRegulation.name,
          topic: newRegulation.topic,
          category: newRegulation.category
        }
      });

    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `Error processing regulation ${regulationId}`, {
          id: "REGULATION_PROCESSING_ERROR",
          parameters: {
            error: error instanceof Error ? error.message : String(error),
            regulationId
          }
        });

      failureCount++;
      results.push({
        regulationId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const summary = {
    totalProcessed: regulationIds.length,
    successful: successCount,
    failed: failureCount,
    skipped: skipCount,
    results
  };

  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Regulation Population Summary:', {
    id: "POPULATION_SUMMARY",
    parameters: summary
  });
  return summary;
}