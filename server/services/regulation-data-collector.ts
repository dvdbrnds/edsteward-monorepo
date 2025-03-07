import { db } from "../db";
import { regulations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { syslog, LogLevel, LogFacility } from './syslog';
import OpenAI from "openai";
import type { InsertRegulation } from "@shared/schema";
import { storage } from "../storage";
import { scrapeRegulationUrls } from './web-scraper';
import { fetchRegulationFromAgency } from './agency-api-service';

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

const AGENCY_BASE_URLS = {
  'ED': {
    baseUrl: 'https://www2.ed.gov',
    regulationPaths: [
      '/policy/gen/guid/fpco/ferpa',
      '/about/offices/list/ocr',
      '/policy/highered/reg',
      '/about/offices/list/ope/policy',
      '/about/offices/list/oese/legislation',
      '/idea/regs',
      '/policy/elsec/leg/esea02'
    ]
  },
  'DOL': {
    baseUrl: 'https://www.dol.gov',
    regulationPaths: [
      '/agencies/oasam/regulatory/statutes',
      '/general/topic/discrimination',
      '/agencies/eta/policy',
      '/agencies/whd/laws-and-regulations',
      '/agencies/ebsa/laws-and-regulations',
      '/agencies/osha/laws-and-regulations'
    ]
  },
  'EEOC': {
    baseUrl: 'https://www.eeoc.gov',
    regulationPaths: [
      '/laws-regulations',
      '/regulations',
      '/guidance',
      '/youth/laws'
    ]
  },
  'ADA': {
    baseUrl: 'https://www.ada.gov',
    regulationPaths: [
      '/education',
      '/education/higher-ed-guidance',
      '/education/higher-ed-requirements',
      '/enforcement/settlement-agreements'
    ]
  },
  'OCR': {
    baseUrl: 'https://www2.ed.gov/about/offices/list/ocr',
    regulationPaths: [
      '/frontpage/pro-students/race-origin',
      '/frontpage/pro-students/sex-discrimination',
      '/frontpage/pro-students/disability',
      '/frontpage/pro-students/language-minorities'
    ]
  }
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

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "OpenAI API connection successful");
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

async function gatherRegulationData(regulationId: string): Promise<RegulationResponse | null> {
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
        `Attempt ${attempts + 1}/${MAX_RETRIES} to gather data for regulation ${regulationId}`);

      // First try to get data from agency API
      const apiData = await fetchRegulationFromAgency(regulationId);

      // Initialize content containers
      let primaryContent = '';
      let supplementaryContent = '';
      let downloadLinks = '';
      let sources: Array<{url: string; type: string}> = [];

      // Process API data if available
      if (apiData && apiData.length > 0) {
        primaryContent = apiData.map(regulation => 
          `API Data for ${regulation.id}:\n${JSON.stringify(regulation, null, 2)}`
        ).join('\n\n');
        sources.push({ url: apiData[0].url, type: 'agency-api' });
      }

      // Always try web scraping to gather supplementary data
      const scrapedResults = await scrapeRegulationUrls(regulationId);

      for (const result of scrapedResults) {
        if (result.content) {
          sources.push({ url: result.title || result.url || 'Unknown', type: 'web-scrape' });

          if (!result.downloadUrls?.length) {
            primaryContent += `\nContent from ${result.title || 'Main Page'}:\n${result.content}\n`;
          } else {
            supplementaryContent += `\nSupplementary content from ${result.title || 'Document'}:\n${result.content}\n`;
          }
        }

        if (result.downloadUrls?.length) {
          downloadLinks += `\nRelated documents:\n${result.downloadUrls.join('\n')}\n`;
          result.downloadUrls.forEach(url => {
            sources.push({ url, type: 'document-link' });
          });
        }
      }

      const combinedContent = `
Primary Content:
${primaryContent}

Supplementary Content:
${supplementaryContent}

Available Documents:
${downloadLinks}

Data Sources:
${sources.map(s => `- ${s.type}: ${s.url}`).join('\n')}
`.trim();

      // Log content details before sending to OpenAI
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Preparing to send content to OpenAI for regulation ${regulationId}`, {
          id: "CONTENT_SUMMARY",
          parameters: {
            contentLength: combinedContent.length,
            primaryContentLength: primaryContent.length,
            supplementaryContentLength: supplementaryContent.length,
            documentCount: downloadLinks.split('\n').length,
            sourceCount: sources.length,
            preview: combinedContent.substring(0, 200) + '...'
          }
        });

      if (!combinedContent) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
          `No content found for regulation ${regulationId}`);
        return null;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert in higher education compliance regulations. Analyze the provided content from official agency websites to extract detailed regulation information. Focus on:

1. Official names and legal citations
2. Core requirements for educational institutions
3. Specific compliance guidelines and deadlines
4. Agency contact points and submission procedures

Return ONLY a JSON object with these exact fields:
{
  "name": "Complete regulation title with year if applicable",
  "topic": "Primary subject area (e.g., Civil Rights, Safety, Academic)",
  "statute": "Official legal citation",
  "summary": "Key points and scope of regulation",
  "requirements": "Detailed compliance requirements for educational institutions",
  "category": "One of: Academic Programs, Campus Safety, Civil Rights, Student Services, Administrative",
  "jurisdiction": "federal or state",
  "agency_url": "Primary URL for regulation information",
  "agency_name": "Official agency name",
  "agency_department": "Specific department or office",
  "submission_guidelines": "Required documentation and reporting procedures"
}

Include ONLY factual information found in the provided content.`
          },
          {
            role: "user",
            content: `Analyze this official content for regulation ${regulationId}:

${combinedContent}

Extract and structure the regulation information as a JSON object following the specified format. Include only verifiable information from the provided content.`
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      if (!response.choices[0].message.content) {
        throw new Error("Empty response from OpenAI");
      }

      let regulationData: any;
      try {
        const content = response.choices[0].message.content.trim();
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Received OpenAI response for regulation ${regulationId}`, {
            id: "OPENAI_RESPONSE",
            parameters: {
              content_preview: content.substring(0, 200) + "...",
              length: content.length,
              structure: Object.keys(JSON.parse(content)).join(', ')
            }
          });

        regulationData = JSON.parse(content);
      } catch (parseError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
          `Failed to parse JSON response for regulation ${regulationId}`, {
            id: "JSON_PARSE_ERROR",
            parameters: {
              error: parseError instanceof Error ? parseError.message : String(parseError),
              content: response.choices[0].message.content
            }
          });
        throw parseError;
      }

      // Store source information with the regulation data
      regulationData.sources = sources;

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

interface RegulationResponse {
  name: string;
  topic: string;
  statute: string;
  summary: string;
  requirements: string;
  category: string;
  jurisdiction: "federal" | "state";
  agency_url: string;
  agency_name: string;
  agency_department: string;
  submission_guidelines: string;
  sources?: Array<{url: string; type: string}>;
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

  // Ensure jurisdiction is correctly formatted
  data.jurisdiction = data.jurisdiction.toLowerCase() as "federal" | "state";

  return data as RegulationResponse;
}

async function enrichRegulationData(regulation: RegulationResponse): Promise<InsertRegulation> {
  // Create enriched data with all required fields
  const enrichedData: InsertRegulation = {
    itemId: `REG-${Date.now()}`,
    name: regulation.name,
    topic: regulation.topic,
    statute: regulation.statute,
    category: regulation.category,
    jurisdiction: regulation.jurisdiction,
    isApplicable: true,
    originationDate: null,
    effectiveDate: null,
    lastUpdated: new Date(),
    lastVerified: new Date(),
    nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    filingDeadlines: null,
    reportingFrequency: '',
    agency_url: regulation.agency_url,
    agency_name: regulation.agency_name,
    agency_contact: '',
    agency_department: regulation.agency_department,
    regulationUrl: '',
    requirementsUrl: '',
    submissionGuideUrl: '',
    formsUrl: '',
    submissionGuidelines: regulation.submission_guidelines,
    regulationText: regulation.summary + '\n\n' + regulation.requirements,
    applicableforms: null,
    relatedRegulations: null,
    complianceNotes: '',
    verificationMethod: '',
    notificationSchedule: null
  };

  return enrichedData;
}

export async function populateRegulationData(regulationIds: string[]): Promise<any> {
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
      const existing = await storage.searchRegulations(regulationId);
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
          category: newRegulation.category,
          sources: regulationData.sources
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