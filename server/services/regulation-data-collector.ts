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

// Define agency-specific URLs and their regulation page patterns
const AGENCY_BASE_URLS = {
  'ED': {
    baseUrl: 'https://www2.ed.gov',
    regulationPaths: [
      '/policy/gen/guid/fpco/ferpa',
      '/about/offices/list/ocr',
      '/policy/highered/reg',
      '/about/offices/list/ope/policy'
    ]
  },
  'DOL': {
    baseUrl: 'https://www.dol.gov',
    regulationPaths: [
      '/agencies/oasam/regulatory/statutes',
      '/general/topic/discrimination',
      '/agencies/eta/policy'
    ]
  },
  'OSHA': {
    baseUrl: 'https://www.osha.gov',
    regulationPaths: [
      '/laws-regs',
      '/regulations/standards'
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

      // Prepare search terms from regulation ID
      const searchTerms = regulationId
        .split('-')
        .map(term => term.toLowerCase())
        .filter(term => term !== 'act' && term !== 'law' && !term.match(/^\d+$/));

      let scrapedContent = '';
      let relevantUrls = new Set<string>();

      // Search and scrape from each agency's relevant paths
      for (const [agency, config] of Object.entries(AGENCY_BASE_URLS)) {
        // First check specific regulation paths
        for (const path of config.regulationPaths) {
          const fullUrl = `${config.baseUrl}${path}`;
          try {
            const { content, links } = await scrapeAgencyWebsite(fullUrl);
            if (content) {
              scrapedContent += `\nContent from ${agency} (${fullUrl}):\n${content}\n`;
              // Add relevant links to our set
              links.forEach(link => {
                if (searchTerms.some(term => link.toLowerCase().includes(term))) {
                  relevantUrls.add(link);
                }
              });
            }
          } catch (error) {
            syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
              `Failed to scrape ${agency} path ${path}`, {
                id: "SCRAPE_WARNING",
                parameters: {
                  agency,
                  path,
                  error: error instanceof Error ? error.message : String(error)
                }
              });
          }
        }

        // Then search the site for our specific regulation
        const searchResults = await findRegulationPages(config.baseUrl, searchTerms.join(' '));
        for (const url of searchResults) {
          if (!relevantUrls.has(url)) {
            try {
              const { content } = await scrapeAgencyWebsite(url);
              if (content) {
                scrapedContent += `\nSearch result from ${agency} (${url}):\n${content}\n`;
              }
            } catch (error) {
              syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
                `Failed to scrape search result from ${agency}`, {
                  id: "SEARCH_SCRAPE_WARNING",
                  parameters: {
                    agency,
                    url,
                    error: error instanceof Error ? error.message : String(error)
                  }
                });
            }
          }
        }
      }

      // If we found no content, log warning and proceed with basic info
      if (!scrapedContent.trim()) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
          `No content found for regulation ${regulationId} from any agency`);
      }

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert in higher education compliance regulations. Analyze the provided content from government agency websites to extract detailed regulation information. Focus on:
- Official regulation names and citations
- Specific requirements for educational institutions
- Reporting and compliance guidelines
- Agency contact information and submission procedures

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
}`
          },
          {
            role: "user",
            content: `Analyze this scraped content from agency websites for regulation ${regulationId}:

${scrapedContent}

Extract key regulation information and return it in the specified JSON format. Include only factual information found in the content.`
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
              content_preview: content.substring(0, 100) + "...",
              length: content.length
            }
          });

        regulationData = JSON.parse(content);
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Successfully parsed JSON response for regulation ${regulationId}`);
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