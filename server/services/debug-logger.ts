
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';

const LOG_DIR = path.join(process.cwd(), 'logs');
const DEBUG_LOG_FILE = path.join(LOG_DIR, 'debug.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export class DebugLogger {
  static log(context: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${context}] ${message}${data ? ` - ${JSON.stringify(data, null, 2)}` : ''}\n`;
    
    console.log(logEntry);
    
    // Append to file
    fs.appendFileSync(DEBUG_LOG_FILE, logEntry);
  }
  
  static logRequest(req: Request, context: string): void {
    const requestInfo = {
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      user: req.user || 'Not authenticated'
    };
    
    this.log(context, 'Request received', requestInfo);
  }
  
  static logResponse(res: Response, context: string, data: any): void {
    const responseInfo = {
      statusCode: res.statusCode,
      data
    };
    
    this.log(context, 'Response sent', responseInfo);
  }
  
  static logError(context: string, error: any): void {
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown Error'
    };
    
    this.log(context, 'ERROR', errorInfo);
  }
}
