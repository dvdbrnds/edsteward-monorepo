import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertRegulation } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { regulations } from "@shared/schema";
import { syslog, LogLevel, LogFacility } from '../services/syslog';

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Verify OpenAI API connection on startup
async function verifyOpenAIConnection() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Checking OpenAI API status...");

    const response = await openai.chat.completions.create({
      model: "gpt-4",
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
  // First check if regulation already exists
  const existing = await db.select()
    .from(regulations)
    .where(eq(regulations.itemId, regulationId));

  if (existing.length > 0) {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Regulation ${regulationId} already exists, skipping data gathering`);
    return null;
  }

  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
        `Attempt ${attempts + 1}/${MAX_RETRIES} to gather data for regulation ${regulationId}`);

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert in higher education compliance regulations. For each regulation ID provided, return a JSON object with regulation details. Only respond with the JSON object, no other text. The response must be valid JSON and include the following fields: name, topic, statute, summary, requirements, category (Academic Programs/Campus Safety/Civil Rights/Student Services/Administrative), jurisdiction (federal/state), agency_url, agency_name, agency_department, submission_guidelines."
          },
          {
            role: "user",
            content: `Return a JSON object with regulation details for ID: ${regulationId}`
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: 1000
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
              total_length: content.length,
              format: "json_object"
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
              content: response.choices[0].message.content,
              attempt: attempts + 1
            }
          });
        throw new Error(`Invalid JSON response: ${parseError.message}`);
      }

      const validatedData = await validateRegulationResponse(regulationData);
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
        `Successfully validated data for regulation ${regulationId}`);

      return validatedData;

    } catch (error) {
      attempts++;

      // Handle OpenAI API-specific errors
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
        // Log other errors
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          `Error gathering data for regulation ${regulationId} (Attempt ${attempts}/${MAX_RETRIES})`, {
            id: "REGULATION_DATA_ERROR",
            parameters: {
              error: error instanceof Error ? error.message : String(error),
              attempt: attempts,
              maxRetries: MAX_RETRIES,
              regulationId,
              error_type: error instanceof Error ? error.constructor.name : typeof error
            }
          });
      }

      if (attempts === MAX_RETRIES) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          `Failed to gather data for regulation ${regulationId} after ${MAX_RETRIES} attempts`, {
            id: "MAX_RETRIES_EXCEEDED",
            parameters: {
              regulationId,
              attempts,
              maxRetries: MAX_RETRIES
            }
          });
        return null;
      }

      // Exponential backoff
      await delay(RETRY_DELAY * Math.pow(2, attempts - 1));
    }
  }

  return null;
}

async function enrichRegulationData(regulation: RegulationResponse): Promise<InsertRegulation> {
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Enriching regulation data with additional fields');

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

  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Successfully enriched regulation data');
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

  // Start with just one regulation for testing
  const testRegulationId = regulationIds[0];
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Testing with a single regulation: ${testRegulationId}`);

    const regulationData = await gatherRegulationData(testRegulationId);
    if (!regulationData) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `Failed to gather test data for regulation ${testRegulationId}`);
      return {
        status: 'failed',
        error: 'Failed to gather test regulation data',
        regulationId: testRegulationId
      };
    }

    const enrichedData = await enrichRegulationData(regulationData);
    const newRegulation = await storage.createRegulation(enrichedData);

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Successfully tested regulation data gathering with ${testRegulationId}`);

    return {
      status: 'success',
      regulation: {
        id: newRegulation.id,
        name: newRegulation.name,
        topic: newRegulation.topic,
        category: newRegulation.category
      }
    };

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      `Error in test regulation data gathering`, {
        id: "TEST_REGULATION_ERROR",
        parameters: {
          error: error instanceof Error ? error.message : String(error),
          regulationId: testRegulationId
        }
      });
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      regulationId: testRegulationId
    };
  }
}