import { z } from "zod";
import type { Regulation } from "@shared/schema";
import { parse, isValid } from "date-fns";

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
    
    if (regulation.deadlines) {
      const result = z.string().refine((val) => {
        if (!val) return true; // Allow empty values
        if (val.toLowerCase() === "not applicable") return true; // Allow "Not Applicable"
        try {
          const date = parse(val, 'yyyy-MM-dd', new Date());
          return isValid(date);
        } catch {
          return false;
        }
      }, "Invalid date format. Expected yyyy-MM-dd or 'Not Applicable'").safeParse(regulation.deadlines);
      if (!result.success) {
        errors.push({
          regulationId: regulation.itemId,
          field: 'deadlines',
          error: 'Invalid deadline date format',
          value: regulation.deadlines,
          severity: 'error'
        });
      }
    }
    
    if (regulation.lastUpdated) {
      const date = new Date(regulation.lastUpdated);
      if (isNaN(date.getTime())) {
        errors.push({
          regulationId: regulation.itemId,
          field: 'lastUpdated',
          error: 'Invalid lastUpdated date',
          value: regulation.lastUpdated,
          severity: 'error'
        });
      }
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

    const report: ValidationReport = {
      totalRegulations: regulations.length,
      validRegulations: validCount,
      errors: allErrors.filter(e => e.severity === 'error'),
      warnings: allErrors.filter(e => e.severity === 'warning'),
      timestamp: new Date()
    };

    return report;
  }
}