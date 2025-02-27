import { z } from "zod";
import type { Regulation } from "@shared/schema";
import { parse, isValid, isFuture, isPast } from "date-fns";

// Enhanced URL validation
const urlSchema = z.string().url().optional().or(z.literal(""));

// Define the shape of a validation error
interface ValidationError {
  regulationId: string;
  field: string;
  error: string;
  value: any;
  severity: 'error' | 'warning';
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
    console.log(`Validating URLs for regulation ${regulation.itemId}`);
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
        console.log(`Checking URL for ${field}: ${value}`);
        const result = urlSchema.safeParse(value);
        if (!result.success) {
          errors.push({
            regulationId: regulation.itemId,
            field,
            error: 'Invalid URL format',
            value,
            severity: 'warning'
          });
        }
      }
    });

    return errors;
  }

  private validateDates(regulation: Regulation): ValidationError[] {
    console.log(`Validating dates for regulation ${regulation.itemId}`);
    const errors: ValidationError[] = [];

    // Check origination date
    if (!regulation.originationDate) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'originationDate',
        error: 'Origination date is required',
        value: null,
        severity: 'error'
      });
    } else if (!isPast(new Date(regulation.originationDate))) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'originationDate',
        error: 'Origination date must be in the past',
        value: regulation.originationDate,
        severity: 'error'
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
          severity: 'error'
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
        severity: 'warning'
      });
    }

    return errors;
  }

  private validateRequiredFields(regulation: Regulation): ValidationError[] {
    console.log(`Validating required fields for regulation ${regulation.itemId}`);
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
          severity: 'error'
        });
      }
    });

    return errors;
  }

  private validateContent(regulation: Regulation): ValidationError[] {
    console.log(`Validating content for regulation ${regulation.itemId}`);
    const errors: ValidationError[] = [];

    if (!regulation.summary && !regulation.requirements) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'content',
        error: 'Either summary or requirements must be provided',
        value: null,
        severity: 'warning'
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
          severity: 'warning'
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
        severity: 'error'
      });
    }

    if (!regulation.submissionGuidelines && !regulation.submissionGuideUrl) {
      errors.push({
        regulationId: regulation.itemId,
        field: 'submissionGuidelines',
        error: 'Either submission guidelines or URL must be provided',
        value: null,
        severity: 'warning'
      });
    }

    return errors;
  }


  public validateRegulation(regulation: Regulation): ValidationError[] {
    console.log(`Starting validation for regulation ${regulation.itemId}`);
    const errors = [
      ...this.validateUrls(regulation),
      ...this.validateDates(regulation),
      ...this.validateRequiredFields(regulation),
      ...this.validateSourceVerification(regulation),
      ...this.validateRequiredContent(regulation),
      ...this.validateContent(regulation)
    ];
    console.log(`Validation complete for regulation ${regulation.itemId}. Found ${errors.length} issues.`);
    return errors;
  }

  public async validateAll(regulations: Regulation[]): Promise<ValidationReport> {
    console.log(`Starting batch validation for ${regulations.length} regulations`);
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

    console.log(`Validation complete. ${validCount} valid regulations out of ${regulations.length}`);
    return report;
  }
}