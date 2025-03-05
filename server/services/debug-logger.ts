import { syslog, LogLevel, LogFacility } from './syslog';
import { Request, Response } from 'express';

export class DebugLogger {
  static log(context: string, message: string, data?: any): void {
    console.log(`[DEBUG][${context}] ${message}`, data || '');
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
      user: req.user || 'Not authenticated',
      session: {
        userId: req.session?.userId,
        username: req.session?.username,
        role: req.session?.role
      }
    };

    console.log(`[REQUEST][${context}] ${req.method} ${req.path}`, requestInfo);
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

    console.log(`[RESPONSE][${context}] Status: ${res.statusCode}`, responseInfo);
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

    console.error(`[ERROR][${context}]`, errorInfo);
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Error in ${context}: ${errorInfo.message}`, {
      id: 'ERROR',
      parameters: {
        context,
        errorInfo: JSON.stringify(errorInfo)
      }
    });
  }

  static logSecurity(context: string, message: string, data?: any): void {
    console.log(`[SECURITY][${context}] ${message}`, data || '');
    syslog.logSecurityEvent(LogLevel.NOTICE, message, {
      context,
      ...(data || {})
    });
  }

  static logAudit(context: string, message: string, data?: any): void {
    console.log(`[AUDIT][${context}] ${message}`, data || '');
    syslog.logAuditEvent(LogLevel.INFO, message, {
      context,
      ...(data || {})
    });
  }

  static async logAuthAttempt(context: string, success: boolean, username: string, data?: any): Promise<void> {
    const level = success ? LogLevel.INFO : LogLevel.WARNING;
    const status = success ? "successful" : "failed";
    const authInfo = {
      status,
      username,
      userId: data?.userId,
      reason: data?.reason,
      timestamp: new Date().toISOString()
    };

    console.log(`[AUTH][${context}] Authentication ${status}`, authInfo);
    await syslog.logAuthEvent(level, `Authentication ${status} for user ${username}`, data?.userId, username);
  }
}