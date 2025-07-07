import { db } from '../config/database';

export abstract class BaseRepository {
  protected db = db;

  /**
   * Handle common database errors and provide meaningful messages
   */
  protected handleDatabaseError(error: unknown, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Database error during ${operation}:`, errorMessage);
    
    // Handle specific database error types
    if (errorMessage.includes('unique constraint')) {
      throw new Error(`Duplicate entry: ${operation} failed due to existing record`);
    }
    
    if (errorMessage.includes('foreign key constraint')) {
      throw new Error(`Related record not found: ${operation} failed due to missing dependency`);
    }
    
    if (errorMessage.includes('not null constraint')) {
      throw new Error(`Required field missing: ${operation} failed due to missing required data`);
    }
    
    throw new Error(`${operation} failed: ${errorMessage}`);
  }

  /**
   * Validate that a record exists before operations
   */
  protected async validateExists<T>(
    id: number, 
    findFn: (id: number) => Promise<T | null | undefined>,
    entityName: string
  ): Promise<T> {
    const record = await findFn(id);
    if (!record) {
      throw new Error(`${entityName} with id ${id} not found`);
    }
    return record;
  }
} 