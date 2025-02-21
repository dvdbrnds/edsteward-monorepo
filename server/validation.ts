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
            severity: 'warning'
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

    // Validate filing deadlines
    if (regulation.filingDeadlines) {
      regulation.filingDeadlines.forEach((deadline, index) => {
        try {
          const deadlineDate = parse(deadline.date, 'yyyy-MM-dd', new Date());
          if (!isValid(deadlineDate)) {
            errors.push({
              regulationId: regulation.itemId,
              field: `filingDeadlines[${index}].date`,
              error: 'Invalid deadline date format',
              value: deadline.date,
              severity: 'error'
            });
          }
        } catch {
          errors.push({
            regulationId: regulation.itemId,
            field: `filingDeadlines[${index}].date`,
            error: 'Invalid deadline date',
            value: deadline.date,
            severity: 'error'
          });
        }
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

  private validateRequiredFields(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!regulation.itemId || regulation.itemId.trim() === '') {
      errors.push({
        regulationId: regulation.itemId || 'unknown',
        field: 'itemId',
        error: 'Item ID is required',
        value: regulation.itemId,
        severity: 'error'
      });
    }

    if (!regulation.topic || regulation.topic.trim() === '') {
      errors.push({
        regulationId: regulation.itemId || 'unknown',
        field: 'topic',
        error: 'Topic is required',
        value: regulation.topic,
        severity: 'error'
      });
    }

    if (!regulation.statute || regulation.statute.trim() === '') {
      errors.push({
        regulationId: regulation.itemId || 'unknown',
        field: 'statute',
        error: 'Statute is required',
        value: regulation.statute,
        severity: 'error'
      });
    }

    if (!regulation.category || regulation.category.trim() === '') {
      errors.push({
        regulationId: regulation.itemId || 'unknown',
        field: 'category',
        error: 'Category is required',
        value: regulation.category,
        severity: 'error'
      });
    }

    // Validate URLs if present
    if (regulation.agency_url && !regulation.agency_url.startsWith('http')) {
      errors.push({
        regulationId: regulation.itemId || 'unknown',
        field: 'agency_url',
        error: 'Agency URL must start with http:// or https://',
        value: regulation.agency_url,
        severity: 'warning'
      });
    }

    return errors;
  }

  public validateRegulation(regulation: Regulation): ValidationError[] {
    return [
      ...this.validateUrls(regulation),
      ...this.validateDates(regulation),
      ...this.validateRequiredFields(regulation),
      ...this.validateSourceVerification(regulation),
      ...this.validateRequiredContent(regulation)
    ];
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

    return {
      totalRegulations: regulations.length,
      validRegulations: validCount,
      errors: allErrors.filter(e => e.severity === 'error'),
      warnings: allErrors.filter(e => e.severity === 'warning'),
      timestamp: new Date()
    };
  }
}