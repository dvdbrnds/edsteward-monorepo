import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertRegulation } from "@shared/schema";
import { db } from "../db";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

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

  if (!['federal', 'state'].includes(data.jurisdiction)) {
    throw new Error(`Invalid jurisdiction: ${data.jurisdiction}. Must be 'federal' or 'state'`);
  }

  return data as RegulationResponse;
}

async function gatherRegulationData(regulationId: string): Promise<RegulationResponse | null> {
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      console.log(`Attempt ${attempts + 1}/${MAX_RETRIES} to gather data for regulation ${regulationId}`);

      const prompt = `Please analyze and provide detailed information about regulation ID ${regulationId} in JSON format. Include the following:
      - Full name of the regulation
      - Topic/subject matter
      - Statute reference
      - Detailed summary
      - Key requirements
      - Category (e.g., 'Human Resources', 'Academic Programs', etc.)
      - Jurisdiction ('federal' or 'state')
      - Agency information (URL, name, department)
      - Submission guidelines if applicable

      Format the response as a JSON object with these exact keys:
      name, topic, statute, summary, requirements, category, jurisdiction, agency_url, agency_name, agency_department, submission_guidelines`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      if (!response.choices[0].message.content) {
        throw new Error("Empty response from OpenAI");
      }

      console.log(`Successfully received response for ${regulationId}`);

      const regulationData = JSON.parse(response.choices[0].message.content);
      const validatedData = await validateRegulationResponse(regulationData);

      console.log(`Validation successful for regulation ${regulationId}`);
      return validatedData;

    } catch (error) {
      attempts++;
      console.error(`Error gathering data for regulation ${regulationId} (Attempt ${attempts}/${MAX_RETRIES}):`, error);

      if (attempts === MAX_RETRIES) {
        console.error(`Failed to gather data for regulation ${regulationId} after ${MAX_RETRIES} attempts`);
        return null;
      }

      await delay(RETRY_DELAY * attempts); // Exponential backoff
    }
  }

  return null;
}

async function enrichRegulationData(regulation: RegulationResponse): Promise<InsertRegulation> {
  console.log('Enriching regulation data with additional fields');

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

  console.log('Successfully enriched regulation data');
  return enrichedData;
}

export async function populateRegulationData(regulationIds: string[]): Promise<any> {
  console.log(`Starting regulation data population for ${regulationIds.length} regulations`);

  let successCount = 0;
  let failureCount = 0;
  let results = [];

  for (const regulationId of regulationIds) {
    try {
      console.log(`Gathering data for regulation ${regulationId}`);
      const regulationData = await gatherRegulationData(regulationId);

      if (!regulationData) {
        console.error(`Failed to gather data for regulation ${regulationId}`);
        failureCount++;
        results.push({
          regulationId,
          status: 'failed',
          error: 'Failed to gather regulation data'
        });
        continue;
      }

      const enrichedData = await enrichRegulationData(regulationData);
      console.log('Creating new regulation:', enrichedData);

      const newRegulation = await storage.createRegulation(enrichedData);
      console.log('Created regulation:', newRegulation);

      results.push({
        regulationId,
        status: 'success',
        data: {
          name: newRegulation.name,
          topic: newRegulation.topic,
          category: newRegulation.category
        }
      });

      console.log(`Successfully populated data for regulation ${regulationId}`);
      successCount++;

    } catch (error) {
      console.error(`Error processing regulation ${regulationId}:`, error);
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
    results
  };

  console.log('\nRegulation Population Summary:', summary);
  return summary;
}