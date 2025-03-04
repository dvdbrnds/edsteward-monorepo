import { syslog, LogLevel, LogFacility } from './syslog';
import { Request, Response } from 'express';

export class DebugLogger {
  static log(context: string, message: string, data?: any): void {
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, message, {
      id: 'DEBUG',
      parameters: {
        context,
        ...(data ? { data: JSON.stringify(data) } : {})
      }
    });
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

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Request received: ${req.method} ${req.path}`, {
      id: 'REQUEST',
      parameters: {
        context,
        requestInfo: JSON.stringify(requestInfo)
      }
    });
  }

  static logResponse(res: Response, context: string, data: any): void {
    const responseInfo = {
      statusCode: res.statusCode,
      data
    };

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Response sent: ${res.statusCode}`, {
      id: 'RESPONSE',
      parameters: {
        context,
        responseInfo: JSON.stringify(responseInfo)
      }
    });
  }

  static logError(context: string, error: any): void {
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown Error'
    };

    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error in ${context}: ${errorInfo.message}`, {
      id: 'ERROR',
      parameters: {
        context,
        errorInfo: JSON.stringify(errorInfo)
      }
    });
  }

  static logSecurity(context: string, message: string, data?: any): void {
    syslog.logSecurityEvent(LogLevel.NOTICE, message, {
      context,
      ...(data || {})
    });
  }

  static logAudit(context: string, message: string, data?: any): void {
    syslog.logAuditEvent(LogLevel.INFO, message, {
      context,
      ...(data || {})
    });
  }
}