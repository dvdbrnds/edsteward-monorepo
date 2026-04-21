/**
 * @module RegulationValidator
 * @description Validates regulations against defined compliance rules
 * 
 * Validation Rules:
 * 
 * ERRORS (Critical issues that must be fixed):
 * 1. Missing Required Fields
 *    - ItemID, Name, Topic, Statute, Category are mandatory
 *    - Missing values trigger errors
 * 
 * 2. Date Validation
 *    - Origination date must be in the past
 *    - Effective date must be after origination date
 *    - Next review date must be in the future
 * 
 * 3. URL Format
 *    - All URLs must be valid and accessible
 *    - Agency URLs must be official (.gov, .edu domains)
 * 
 * WARNINGS (Issues that should be reviewed):
 * 1. Content Completeness
 *    - Missing summary or requirements (at least one should be present)
 *    - Missing submission guidelines
 * 
 * 2. Documentation Currency
 *    - Source verification older than 6 months
 *    - Last review date approaching or passed
 * 
 * 3. Reference Integrity
 *    - Missing statute IDs
 *    - Incomplete agency information
 * 
 */

import { z } from "zod";
import type { Regulation } from "@shared/schema";
import { isFuture, isPast } from "date-fns";

// Enhanced URL validation
const urlSchema = z.string().url().optional().or(z.literal(""));

// Define the shape of a validation error
interface ValidationError {
  regulationId: string;
  field: string;
  error: string;
  value: any;
  severity: 'error' | 'warning';
  category: 'required_fields' | 'dates' | 'urls' | 'content' | 'documentation' | 'references';
  priority: 1 | 2 | 3; // 1 = highest, 3 = lowest
}

// Define the shape of a validation report
interface ValidationReport {
  totalRegulations: number;
  validRegulations: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  timestamp: Date;
}

// Enhanced validation class
export class RegulationValidator {
  private validateUrls(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];

    // Array of URL fields to validate
    const urlFields = [
      { field: 'agency_url', value: regulation.agency_url },
      { field: 'regulationUrl', value: regulation.regulationUrl },
      { field: 'requirementsUrl', value: regulation.requirementsUrl },
      { field: 'submissionGuideUrl', value: regulation.submissionGuideUrl },
      { field: 'formsUrl', value: regulation.formsUrl }
    ];

    urlFields.forEach(({ field, value }) => {
      if (value) {
        const result = urlSchema.safeParse(value);
        if (!result.success) {
          errors.push({
            regulationId: regulation.itemId,
            field,
            error: 'Invalid URL format',
            value,
            severity: 'error',
            category: 'urls',
            priority: 2
          });
        }

        // Check for official domains in agency URLs
        if (field === 'agency_url' && !value.match(/\.(gov|edu)$/)) {
          errors.push({
            regulationId: regulation.itemId,
            field,
            error: 'Agency URL should use .gov or .edu domain',
            value,
            severity: 'warning',
            category: 'urls',
            priority: 3
          });
        }
      }
    });

    return errors;
  }

  private validateDates(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check origination date
    if (!regulation.originationDate) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'originationDate',
        error: 'Origination date is required',
        value: null,
        severity: 'error',
        category: 'dates',
        priority: 1
      });
    } else if (!isPast(new Date(regulation.originationDate))) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'originationDate',
        error: 'Origination date must be in the past',
        value: regulation.originationDate,
        severity: 'error',
        category: 'dates',
        priority: 1
      });
    }

    // Check effective date
    if (regulation.effectiveDate) {
      const effectiveDate = new Date(regulation.effectiveDate);
      const originationDate = regulation.originationDate ? new Date(regulation.originationDate) : null;

      if (originationDate && effectiveDate < originationDate) {
        errors.push({
          regulationId: regulation.itemId,
          field: 'effectiveDate',
          error: 'Effective date cannot be before origination date',
          value: regulation.effectiveDate,
          severity: 'error',
          category: 'dates',
          priority: 1
        });
      }
    }

    // Check next review date
    if (regulation.nextReviewDate && !isFuture(new Date(regulation.nextReviewDate))) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'nextReviewDate',
        error: 'Next review date must be in the future',
        value: regulation.nextReviewDate,
        severity: 'error',
        category: 'dates',
        priority: 2
      });
    }

    return errors;
  }

  private validateRequiredFields(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];

    const requiredFields = [
      { field: 'itemId', value: regulation.itemId },
      { field: 'name', value: regulation.name },
      { field: 'topic', value: regulation.topic },
      { field: 'statute', value: regulation.statute },
      { field: 'category', value: regulation.category }
    ];

    requiredFields.forEach(({ field, value }) => {
      if (!value || value.trim() === '') {
        errors.push({
          regulationId: regulation.itemId || 'unknown',
          field,
          error: `${field} is required`,
          value,
          severity: 'error',
          category: 'required_fields',
          priority: 1
        });
      }
    });

    return errors;
  }

  private validateContent(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for either summary or requirements
    if (!regulation.summary && !regulation.requirements) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'content',
        error: 'Either summary or requirements must be provided',
        value: null,
        severity: 'warning',
        category: 'content',
        priority: 2
      });
    }

    // Check minimum content length
    if (regulation.summary && regulation.summary.length < 50) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'summary',
        error: 'Summary should be at least 50 characters',
        value: regulation.summary,
        severity: 'warning',
        category: 'content',
        priority: 3
      });
    }

    return errors;
  }

  private validateSourceVerification(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if source verification is recent (within last 6 months)
    if (regulation.lastVerified) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const verificationDate = new Date(regulation.lastVerified);
      if (verificationDate < sixMonthsAgo) {
        errors.push({
          regulationId: regulation.itemId,
          field: 'lastVerified',
          error: 'Source verification is older than 6 months',
          value: regulation.lastVerified,
          severity: 'warning',
          category: 'documentation',
          priority: 2
        });
      }
    }

    return errors;
  }

  private validateRequiredContent(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for missing critical content
    if (!regulation.regulationText && !regulation.regulationUrl) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'regulationText',
        error: 'Either regulation text or URL must be provided',
        value: null,
        severity: 'error',
        category: 'content',
        priority: 1
      });
    }

    // Check for submission guidelines
    if (!regulation.submissionGuidelines && !regulation.submissionGuideUrl) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'submissionGuidelines',
        error: 'Either submission guidelines or URL must be provided',
        value: null,
        severity: 'warning',
        category: 'content',
        priority: 2
      });
    }

    // Check for reference integrity
    if (!regulation.statuteIds) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'statuteIds',
        error: 'Statute reference ID should be provided',
        value: null,
        severity: 'warning',
        category: 'references',
        priority: 3
      });
    }

    return errors;
  }

  private determineRequiredActions(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];
    const requiresAttestation = regulation.requirements?.toLowerCase().includes('attestation') ||
                              regulation.requirements?.toLowerCase().includes('certify') ||
                              regulation.requirements?.toLowerCase().includes('verify');

    const requiresWebPublish = regulation.requirements?.toLowerCase().includes('publish') ||
                             regulation.requirements?.toLowerCase().includes('public notice') ||
                             regulation.requirements?.toLowerCase().includes('make available');

    const requiresCommunication = regulation.requirements?.toLowerCase().includes('notify') ||
                                regulation.requirements?.toLowerCase().includes('inform') ||
                                regulation.requirements?.toLowerCase().includes('communicate');

    const requiresSubmission = regulation.requirements?.toLowerCase().includes('submit') ||
                             regulation.requirements?.toLowerCase().includes('file') ||
                             regulation.requirements?.toLowerCase().includes('report');

    // Initialize actions array if it doesn't exist
    if (!regulation.actions) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'actions',
        error: 'Actions configuration is missing',
        value: null,
        severity: 'warning',
        category: 'content',
        priority: 2
      });
      return errors;
    }

    // Validate each action type
    const actionTypes = ['attestation', 'website_publish', 'community_communication', 'agency_submission'] as const;
    const requirements = {
      attestation: requiresAttestation,
      website_publish: requiresWebPublish,
      community_communication: requiresCommunication,
      agency_submission: requiresSubmission
    };

    actionTypes.forEach(type => {
      const action = regulation.actions?.find((a: { type: string }) => a.type === type);
      if (!action) {
        errors.push({
          regulationId: regulation.itemId,
          field: 'actions',
          error: `Missing ${type} action configuration`,
          value: null,
          severity: 'warning',
          category: 'content',
          priority: 2
        });
      } else if (requirements[type] && !action.required) {
        errors.push({
          regulationId: regulation.itemId,
          field: `actions.${type}`,
          error: `${type} appears to be required based on regulation text`,
          value: action,
          severity: 'warning',
          category: 'content',
          priority: 3
        });
      }
    });

    return errors;
  }

  public validateRegulation(regulation: Regulation): ValidationError[] {
    const errors = [
      ...this.validateUrls(regulation),
      ...this.validateDates(regulation),
      ...this.validateRequiredFields(regulation),
      ...this.validateSourceVerification(regulation),
      ...this.validateRequiredContent(regulation),
      ...this.validateContent(regulation),
      ...this.determineRequiredActions(regulation)
    ];

    // Sort errors by priority
    errors.sort((a, b) => a.priority - b.priority);

    return errors;
  }

  public async validateAll(regulations: Regulation[]): Promise<ValidationReport> {
    const allErrors: ValidationError[] = [];
    let validCount = 0;

    for (const regulation of regulations) {
      const errors = this.validateRegulation(regulation);
      if (errors.length === 0) {
        validCount++;
      } else {
        allErrors.push(...errors);
      }
    }

    const report = {
      totalRegulations: regulations.length,
      validRegulations: validCount,
      errors: allErrors.filter(e => e.severity === 'error'),
      warnings: allErrors.filter(e => e.severity === 'warning'),
      timestamp: new Date()
    };

    return report;
  }
}