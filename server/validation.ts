import { z } from "zod";
import type { Regulation } from "@shared/schema";
import { parse, isValid } from "date-fns";

// Validation schemas for specific fields
const urlSchema = z.string().url().optional().or(z.literal(""));
const dateSchema = z.string().refine((val) => {
  if (!val) return false;
  try {
    const date = parse(val, 'yyyy-MM-dd', new Date());
    return isValid(date);
  } catch {
    return false;
  }
}, "Invalid date format. Expected yyyy-MM-dd");

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

export class RegulationValidator {
  private validateUrls(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (regulation.agency_url) {
      const result = urlSchema.safeParse(regulation.agency_url);
      if (!result.success) {
        errors.push({
          regulationId: regulation.itemId,
          field: 'agency_url',
          error: 'Invalid URL format',
          value: regulation.agency_url,
          severity: 'warning'
        });
      }
    }
    
    return errors;
  }

  private validateDates(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (regulation.deadlines) {
      const result = dateSchema.safeParse(regulation.deadlines);
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

  private validateRequiredFields(regulation: Regulation): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!regulation.topic || regulation.topic.trim() === '') {
      errors.push({
        regulationId: regulation.itemId,
        field: 'topic',
        error: 'Topic is required',
        value: regulation.topic,
        severity: 'error'
      });
    }
    
    if (!regulation.statute || regulation.statute.trim() === '') {
      errors.push({
        regulationId: regulation.itemId,
        field: 'statute',
        error: 'Statute is required',
        value: regulation.statute,
        severity: 'error'
      });
    }

    if (!regulation.category || regulation.category.trim() === '') {
      errors.push({
        regulationId: regulation.itemId,
        field: 'category',
        error: 'Category is required',
        value: regulation.category,
        severity: 'error'
      });
    }
    
    return errors;
  }

  public validateRegulation(regulation: Regulation): ValidationError[] {
    return [
      ...this.validateUrls(regulation),
      ...this.validateDates(regulation),
      ...this.validateRequiredFields(regulation)
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
